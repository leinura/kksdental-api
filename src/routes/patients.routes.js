const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { generatePatientCode, generateCaseCode } = require("../utils/codeGenerator");
const { notifyAdmins } = require("../utils/notifyAdmins");
const { computeOrderPricing } = require("../utils/priceLookup");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// POST /api/patients/register - Patient Registration screen (new patients only)
// Dentist only. Creates the Patient profile and their first Case together.
// Supports the same three pricing paths as Billing (see priceLookup.js).
router.post("/register", requireRole("DENTIST"), async (req, res) => {
  const {
    fullName,
    gender,
    age,
    serviceId,
    serviceTypeId,
    warrantyId,
    serviceSubtypeId,
    serviceTypeWarrantyId,
    stepIds,
    toothShadeId,
    toothNumbers, // array of FDI codes, e.g. ["11","12"]
    quantity, // optional - defaults to toothNumbers.length
    comment, // optional free-text note from the clinic
    photos, // optional array of base64 data-URI strings
  } = req.body;

  if (!fullName || !gender || !age || !serviceId || !serviceTypeId) {
    return res.status(400).json({ error: "Missing required patient or case fields" });
  }

  try {
    const existing = await prisma.patient.findFirst({
      where: {
        clinicId: req.user.clinicId,
        fullName: { equals: fullName, mode: "insensitive" },
      },
    });
    if (existing) {
      return res.status(409).json({
        error: `A patient named "${existing.fullName}" is already registered (ID: ${existing.patientCode}). Use Billing to search for and select the existing patient instead of registering them again.`,
      });
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
            caseId: newCase.id,
            serviceStepId: s.serviceStepId,
            name: s.name,
            price: s.price,
          })),
        });
      }

      if (Array.isArray(photos) && photos.length > 0) {
        await tx.casePhoto.createMany({
          data: photos.map((imageData) => ({ caseId: newCase.id, imageData })),
        });
      }

      return { patient, case: newCase };
    });

    const clinic = await prisma.clinic.findUnique({ where: { id: req.user.clinicId }, select: { name: true } });
    const regCode = `REG-${result.patient.patientCode.replace(/^PT-/, "")}`;
    notifyAdmins({
      type: "NEW_ORDER",
      message: `New patient registered from clinic ${clinic?.name || "Unknown"}: ${result.patient.fullName} (${regCode})`,
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