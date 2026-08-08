const express = require("express");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// GET/PATCH /api/clinics/me - a dentist/clinic editing their own business
// details. Placed before the admin-only middleware below so DENTIST role
// can reach it; everything after that middleware is admin/staff only.
router.get("/me", requireRole("DENTIST"), async (req, res) => {
  const clinic = await prisma.clinic.findUnique({ where: { id: req.user.clinicId } });
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  res.json(clinic);
});

router.patch("/me", requireRole("DENTIST"), async (req, res) => {
  const { name, contactPerson, email, phone, address } = req.body;
  try {
    const updated = await prisma.clinic.update({
      where: { id: req.user.clinicId },
      data: { name, contactPerson, email, phone, address },
    });
    res.json(updated);
  } catch (err) {
    console.error("Update own clinic error:", err);
    res.status(500).json({ error: "Failed to update clinic profile" });
  }
});

// All routes here are admin/lab-staff only - clinics are created manually,
// never through self-registration.
router.use(requireRole("ADMIN", "LAB_STAFF"));

// GET /api/clinics - Clinic Directory
router.get("/", async (req, res) => {
  const clinics = await prisma.clinic.findMany({
    include: { user: { select: { email: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(clinics);
});

// POST /api/clinics - Add New Clinic (creates Clinic + linked User in one go)
router.post("/", async (req, res) => {
  const { name, contactPerson, email, phone, address, username, password } = req.body;

  if (!name || !contactPerson || !email || !phone || !address || !username || !password) {
    return res.status(400).json({ error: "All fields are required to create a clinic account" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const clinic = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: contactPerson, email, username, passwordHash, role: "DENTIST" },
      });
      return tx.clinic.create({
        data: { name, contactPerson, email, phone, address, userId: user.id },
      });
    });

    res.status(201).json(clinic);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "That email or username is already in use" });
    }
    console.error("Create clinic error:", err);
    res.status(500).json({ error: "Failed to create clinic" });
  }
});

// PUT /api/clinics/:id - Edit clinic info, optionally reset login credentials
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, contactPerson, email, phone, address, username, password } = req.body;

  try {
    const clinic = await prisma.clinic.findUnique({ where: { id } });
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });

    await prisma.clinic.update({
      where: { id },
      data: { name, contactPerson, email, phone, address },
    });

    // Password left blank means "keep current password" - only touch the
    // User record if a new username or password was actually provided.
    if (username || password) {
      const userUpdate = {};
      if (username) userUpdate.username = username;
      if (password) userUpdate.passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.update({ where: { id: clinic.userId }, data: userUpdate });
    }

    const updated = await prisma.clinic.findUnique({
      where: { id },
      include: { user: { select: { email: true, username: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error("Update clinic error:", err);
    res.status(500).json({ error: "Failed to update clinic" });
  }
});

// GET /api/clinics/:id/ledger
// Single source of truth for clinic finances - powers Manage Clinics >
// Account Summary, the admin Invoice detail view, and the client's own
// Clinic-wise Invoices screen (dentists hit this same shape via /me/ledger).
router.get("/:id/ledger", async (req, res) => {
  const { id } = req.params;

  const [cases, transactions] = await Promise.all([
    prisma.case.findMany({
      where: { clinicId: id },
      include: { patient: true, service: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: { clinicId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalBilled = cases.reduce((sum, c) => sum + Number(c.totalPrice), 0);
  const totalPaid = transactions
    .filter((t) => t.type === "PAYMENT")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalAdjustment = transactions
    .filter((t) => t.type === "ADJUSTMENT")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const due = totalBilled - totalPaid - totalAdjustment;

  res.json({
    cases,
    transactions,
    summary: { totalBilled, totalPaid, totalAdjustment, due },
  });
});

// POST /api/clinics/:id/transactions - Add Payment / Adjustment
router.post("/:id/transactions", async (req, res) => {
  const { id } = req.params;
  const { amount, type, remarks, caseId } = req.body;

  if (!amount || !type) {
    return res.status(400).json({ error: "Amount and type are required" });
  }
  if (!["PAYMENT", "ADJUSTMENT"].includes(type)) {
    return res.status(400).json({ error: "Type must be PAYMENT or ADJUSTMENT" });
  }

  const transaction = await prisma.transaction.create({
    data: {
      clinicId: id,
      caseId: caseId || null,
      amount,
      type,
      method: "MANUAL",
      remarks: remarks || null,
      createdById: req.user.id,
    },
  });

  res.status(201).json(transaction);
});

module.exports = router;