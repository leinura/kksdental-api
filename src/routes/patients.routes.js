const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { generatePatientCode, generateCaseCode } = require("../utils/codeGenerator");
const { notifyAdmins } = require("../utils/notifyAdmins");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// Shared price lookup: Service x ServiceType x Warranty -> unit price.
// Price is copied onto the Case at creation time so historical orders keep
// their original price even if the admin price list changes later.
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

// POST /api/patients/register - Patient Registration screen (new patients only)
// Dentist only. Creates the Patient profile and their first Case together.
router.post("/register", requireRole("DENTIST"), async (req, res) => {
  const {
    fullName,
    gender,
    age,
    serviceId,
    serviceTypeId,
    warrantyId,
    toothShadeId,
    toothNumbers, // array of FDI codes, e.g. ["11","12"]
    quantity, // optional - defaults to toothNumbers.length
  } = req.body;

  if (!fullName || !gender || !age || !serviceId || !serviceTypeId || !warrantyId) {
    return res.status(400).json({ error: "Missing required patient or case fields" });
  }

  try {
    const finalQuantity = quantity || (toothNumbers ? toothNumbers.length : 1);
    const unitPrice = await lookupUnitPrice(serviceId, serviceTypeId, warrantyId);
    const totalPrice = unitPrice * finalQuantity;

    const patientCode = await generatePatientCode();
    const caseCode = await generateCaseCode();

    const result = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          patientCode,
          fullName,
          gender,
          age: Number(age),
          clinicId: req.user.clinicId,
        },
      });

      const newCase = await tx.case.create({
        data: {
          caseCode,
          patientId: patient.id,
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

      return { patient, case: newCase };
    });

    notifyAdmins({
      type: "NEW_ORDER",
      message: `New patient registered: ${result.patient.fullName} (${result.case.caseCode})`,
      caseId: result.case.id,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error("Patient registration error:", err);
    res.status(400).json({ error: err.message || "Failed to register patient" });
  }
});

// GET /api/patients - Patient List (scoped to the logged-in clinic)
router.get("/", requireRole("DENTIST"), async (req, res) => {
  const patients = await prisma.patient.findMany({
    where: { clinicId: req.user.clinicId },
    orderBy: { createdAt: "desc" },
  });
  res.json(patients);
});

// GET /api/patients/search?query=... - used by Billing's "existing patient" search
// Matches on Patient ID or Patient Name, scoped to the logged-in clinic.
router.get("/search", requireRole("DENTIST"), async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Provide a Patient ID or Patient Name to search" });

  const patients = await prisma.patient.findMany({
    where: {
      clinicId: req.user.clinicId,
      OR: [
        { patientCode: { contains: query, mode: "insensitive" } },
        { fullName: { contains: query, mode: "insensitive" } },
      ],
    },
  });
  res.json(patients);
});

// GET /api/patients/:id - Patient detail (the "Details" link on Patient List)
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: { cases: { orderBy: { createdAt: "desc" } } },
  });
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  // Dentists can only view their own clinic's patients.
  if (req.user.role === "DENTIST" && patient.clinicId !== req.user.clinicId) {
    return res.status(403).json({ error: "You don't have access to this patient" });
  }

  res.json(patient);
});

module.exports = router;