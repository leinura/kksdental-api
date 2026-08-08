const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { generateCaseCode } = require("../utils/codeGenerator");
const { notifyAdmins } = require("../utils/notifyAdmins");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

async function lookupUnitPrice(serviceId, serviceTypeId, warrantyId) {
  const entry = await prisma.priceListEntry.findUnique({
    where: {
      serviceId_serviceTypeId_warrantyId: { serviceId, serviceTypeId, warrantyId },
    },
  });
  if (!entry) {
    throw new Error("No price configured for this Service / Service Type / Warranty combination");
  }
  return Number(entry.price);
}

// POST /api/cases - Billing screen: new order for an already-registered patient.
// body.payNow + body.paymentMethod distinguish "Order Now" from "Order & Pay".
router.post("/", requireRole("DENTIST"), async (req, res) => {
  const {
    patientId,
    serviceId,
    serviceTypeId,
    warrantyId,
    toothShadeId,
    toothNumbers,
    quantity,
    payNow, // boolean - true for "Order & Pay", false/omitted for "Order Now"
    paymentMethod, // "ONLINE" | "MANUAL" - only relevant when payNow is true
  } = req.body;

  if (!patientId || !serviceId || !serviceTypeId || !warrantyId) {
    return res.status(400).json({ error: "Missing required case fields" });
  }

  try {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || patient.clinicId !== req.user.clinicId) {
      return res.status(404).json({ error: "Patient not found for this clinic" });
    }

    const finalQuantity = quantity || (toothNumbers ? toothNumbers.length : 1);
    const unitPrice = await lookupUnitPrice(serviceId, serviceTypeId, warrantyId);
    const totalPrice = unitPrice * finalQuantity;
    const caseCode = await generateCaseCode();

    const newCase = await prisma.$transaction(async (tx) => {
      const createdCase = await tx.case.create({
        data: {
          caseCode,
          patientId,
          clinicId: req.user.clinicId,
          serviceId,
          serviceTypeId,
          warrantyId,
          toothShadeId: toothShadeId || null,
          toothNumbers: toothNumbers || [],
          quantity: finalQuantity,
          unitPrice,
          totalPrice,
          paymentStatus: payNow ? "PAID" : "UNPAID",
          createdById: req.user.id,
        },
      });

      // "Order & Pay" immediately logs a matching ledger entry.
      // NOTE: for paymentMethod "ONLINE" this assumes the Razorpay charge
      // already succeeded before this endpoint is called - wire the actual
      // payment capture in before trusting payNow in production.
      if (payNow) {
        await tx.transaction.create({
          data: {
            clinicId: req.user.clinicId,
            caseId: createdCase.id,
            amount: totalPrice,
            type: "PAYMENT",
            method: paymentMethod === "ONLINE" ? "ONLINE" : "MANUAL",
            createdById: req.user.id,
          },
        });
      }

      return createdCase;
    });

    notifyAdmins({
      type: "NEW_ORDER",
      message: `New order from clinic: ${newCase.caseCode}`,
      caseId: newCase.id,
    });
    if (payNow) {
      notifyAdmins({
        type: "PAYMENT",
        message: `Payment received for order ${newCase.caseCode}: ₹${Number(totalPrice).toFixed(2)}`,
        caseId: newCase.id,
      });
    }

    res.status(201).json(newCase);
  } catch (err) {
    console.error("Create case error:", err);
    res.status(400).json({ error: err.message || "Failed to create order" });
  }
});

// GET /api/cases - Your Order (dentist, own clinic) / Orders + Track Orders (admin, all clinics)
// Query params: from, to (date range), deliveryStatus, paymentStatus
router.get("/", async (req, res) => {
  const { from, to, deliveryStatus, paymentStatus } = req.query;

  const where = {};
  if (req.user.role === "DENTIST") {
    where.clinicId = req.user.clinicId;
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

// PATCH /api/cases/:id/status - Track Orders: update delivery/payment status.
// Admin/lab staff only. Marking paymentStatus PAID here also logs a
// Transaction so it shows up correctly in the clinic's ledger.
router.patch("/:id/status", requireRole("ADMIN", "LAB_STAFF"), async (req, res) => {
  const { id } = req.params;
  const { deliveryStatus, paymentStatus } = req.body;

  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const data = {};
  if (deliveryStatus) data.deliveryStatus = deliveryStatus;
  if (paymentStatus) data.paymentStatus = paymentStatus;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.case.update({ where: { id }, data });

    const justMarkedPaid = paymentStatus === "PAID" && existing.paymentStatus !== "PAID";
    if (justMarkedPaid) {
      await tx.transaction.create({
        data: {
          clinicId: existing.clinicId,
          caseId: id,
          amount: existing.totalPrice,
          type: "PAYMENT",
          method: "MANUAL",
          remarks: "Marked paid via Track Orders",
          createdById: req.user.id,
        },
      });
    }

    return result;
  });

  res.json(updated);
});

module.exports = router;