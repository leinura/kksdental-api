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
// Every order starts UNPAID regardless of "Order Now" vs "Order & Pay" - both
// Cash and UPI require an admin to actually confirm receipt afterward
// (via Track Orders or Manage Clinics), so no payment is ever auto-marked
// paid at order-creation time. "Order & Pay" is purely a frontend UX flow
// that shows the clinic how to pay (cash reminder or the UPI QR code).
router.post("/", requireRole("DENTIST"), async (req, res) => {
  const { patientId, serviceId, serviceTypeId, warrantyId, toothShadeId, toothNumbers, quantity } = req.body;

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

    const newCase = await prisma.case.create({
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
        createdById: req.user.id,
      },
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
// Admin/lab staff only. Marking paymentStatus PAID requires specifying
// paymentMethod (CASH or UPI) so the resulting Transaction records how the
// clinic actually paid.
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

module.exports = router;