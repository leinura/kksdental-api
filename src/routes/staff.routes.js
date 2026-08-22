const express = require("express");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Admin-only end to end - lab staff accounts are created and removed
// exclusively by the admin, never self-service.
router.use(requireAuth, requireRole("ADMIN"));

// GET /api/staff - list all lab staff accounts
router.get("/", async (req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: "LAB_STAFF" },
    select: { id: true, name: true, email: true, username: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(staff);
});

// POST /api/staff - create a new lab staff account
router.post("/", async (req, res) => {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ error: "Name, email, username, and password are all required" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, username, passwordHash, role: "LAB_STAFF" },
      select: { id: true, name: true, email: true, username: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "That email or username is already in use" });
    }
    console.error("Create staff error:", err);
    res.status(500).json({ error: "Failed to create staff account" });
  }
});

// PUT /api/staff/:id - edit a staff account, optionally reset credentials
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, username, password } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.role !== "LAB_STAFF") {
      return res.status(404).json({ error: "Staff account not found" });
    }

    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (username) data.username = username;
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, username: true, createdAt: true },
    });
    res.json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "That email or username is already in use" });
    }
    console.error("Update staff error:", err);
    res.status(500).json({ error: "Failed to update staff account" });
  }
});

// DELETE /api/staff/:id - remove a staff account (e.g. when someone leaves)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.role !== "LAB_STAFF") {
    return res.status(404).json({ error: "Staff account not found" });
  }

  await prisma.user.delete({ where: { id } });
  res.json({ message: "Staff account removed" });
});

module.exports = router;