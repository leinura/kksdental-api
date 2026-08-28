const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { generateCaseCode } = require("../utils/codeGenerator");
const { notifyAdmins } = require("../utils/notifyAdmins");
const { computeOrderPricing } = require("../utils/priceLookup");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// POST /api/cases - Billing screen: new order for an already-registered patient.
// Supports three pricing paths (see priceLookup.js) - the frontend sends
// whichever fields match the chosen Service Type's configuration.
router.post("/", requireRole("DENTIST"), async (req, res) => {
  const {
    patientId,
    serviceId,
    serviceTypeId,
    warrantyId,
    serviceSubtypeId,
    serviceTypeWarrantyId,
    stepIds,
    toothShadeId,
    toothNumbers,
    quantity,
    comment,
    photos,
  } = req.body;

  if (!patientId || !serviceId || !serviceTypeId) {
    return res.status(400).json({ error: "Missing required case fields" });
  }

  try {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || patient.clinicId !== req.user.clinicId) {
      return res.status(404).json({ error: "Patient not found for this clinic" });
    }

    const pricing = await computeOrderPricing({
      serviceId,
      serviceTypeId,
      warrantyId,
      serviceSubtypeId,
      serviceTypeWarrantyId,
      stepIds,
      quantity,
      toothNumbers,
    });
    const caseCode = await generateCaseCode();

    const newCase = await prisma.$transaction(async (tx) => {
      const createdCase = await tx.case.create({
        data: {
          caseCode,
          patientId,
          clinicId: req.user.clinicId,
          serviceId,
          serviceTypeId,
          warrantyId: warrantyId || null,
          serviceSubtypeId: serviceSubtypeId || null,
          serviceTypeWarrantyId: serviceTypeWarrantyId || null,
          toothShadeId: toothShadeId || null,
          toothNumbers: toothNumbers || [],
          comment: comment || null,
          quantity: pricing.quantity,
          unitPrice: pricing.unitPrice,
          totalPrice: pricing.totalPrice,
          createdById: req.user.id,
        },
      });

      if (pricing.resolvedSteps.length > 0) {
        await tx.caseStep.createMany({
          data: pricing.resolvedSteps.map((s) => ({
            caseId: createdCase.id,
            serviceStepId: s.serviceStepId,
            name: s.name,
            price: s.price,
          })),
        });
      }

      if (Array.isArray(photos) && photos.length > 0) {
        await tx.casePhoto.createMany({
          data: photos.map((imageData) => ({ caseId: createdCase.id, imageData })),
        });
      }

      return createdCase;
    });

    const clinic = await prisma.clinic.findUnique({ where: { id: req.user.clinicId }, select: { name: true } });
    notifyAdmins({
      type: "NEW_ORDER",
      message: `New order from clinic ${clinic?.name || "Unknown"}: ${newCase.caseCode}`,
      caseId: newCase.id,
    });

    res.status(201).json(newCase);
  } catch (err) {
    console.error("Create case error:", err);
    res.status(400).json({ error: err.message || "Failed to create order" });
  }
});

// GET /api/cases - Your Order (dentist, own clinic) / Orders + Track Orders +
// For Lab (admin, all clinics). Query params: from, to (date range),
// deliveryStatus, paymentStatus, clinicId (used by the For Lab tab to scope
// to a single clinic's orders).
router.get("/", async (req, res) => {
  const { from, to, deliveryStatus, paymentStatus, clinicId } = req.query;

  const where = {};
  if (req.user.role === "DENTIST") {
    where.clinicId = req.user.clinicId;
  } else if (clinicId) {
    where.clinicId = clinicId;
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (deliveryStatus) where.deliveryStatus = deliveryStatus;
  if (paymentStatus) where.paymentStatus = paymentStatus;

  const cases = await prisma.case.findMany({
    where,
    include: { patient: true, clinic: true, service: true, serviceType: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(cases);
});

// GET /api/cases/:id - full single-order detail, including uploaded patient
// photos, and now the Sub-Type / Service-Type-Warranty / step breakdown
// when the order used the newer pricing paths.
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const singleCase = await prisma.case.findUnique({
    where: { id },
    include: {
      patient: true,
      clinic: true,
      service: true,
      serviceType: true,
      warranty: true,
      toothShade: true,
      serviceSubtype: true,
      serviceTypeWarranty: true,
      caseSteps: true,
      transactions: { orderBy: { createdAt: "desc" } },
      photos: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!singleCase) return res.status(404).json({ error: "Order not found" });

  if (req.user.role === "DENTIST" && singleCase.clinicId !== req.user.clinicId) {
    return res.status(403).json({ error: "You don't have access to this order" });
  }

  res.json(singleCase);
});

// PATCH /api/cases/:id/status - Track Orders: update delivery/payment status.
router.patch("/:id/status", requireRole("ADMIN", "LAB_STAFF"), async (req, res) => {
  const { id } = req.params;
  const { deliveryStatus, paymentStatus, paymentMethod } = req.body;

  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const justMarkingPaid = paymentStatus === "PAID" && existing.paymentStatus !== "PAID";
  if (justMarkingPaid && !["CASH", "UPI"].includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod (CASH or UPI) is required when marking an order paid" });
  }

  const data = {};
  if (deliveryStatus) data.deliveryStatus = deliveryStatus;
  if (paymentStatus) data.paymentStatus = paymentStatus;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.case.update({ where: { id }, data });

    if (justMarkingPaid) {
      await tx.transaction.create({
        data: {
          clinicId: existing.clinicId,
          caseId: id,
          amount: existing.totalPrice,
          type: "PAYMENT",
          method: paymentMethod,
          remarks: "Marked paid via Track Orders",
          createdById: req.user.id,
        },
      });
    }

    return result;
  });

  res.json(updated);
});

// PATCH /api/cases/:id/pickup - Order Detail: lab staff marks an order as
// physically picked up. Separate from delivery/payment status - this is
// purely a "has someone from the lab collected this yet" flag.
router.patch("/:id/pickup", requireRole("ADMIN", "LAB_STAFF"), async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const updated = await prisma.case.update({
    where: { id },
    data: { pickedUpAt: new Date() },
  });

  res.json(updated);
});

module.exports = router;