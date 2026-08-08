const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/gallery - public, no login required (shown on the Welcome screen)
router.get("/", async (req, res) => {
  const photos = await prisma.galleryPhoto.findMany({ orderBy: { createdAt: "desc" } });
  res.json(photos);
});

// POST /api/gallery - lab staff/admin only
router.post("/", requireAuth, requireRole("ADMIN", "LAB_STAFF"), async (req, res) => {
  const { imageData, caption } = req.body;
  if (!imageData) {
    return res.status(400).json({ error: "Image data is required" });
  }
  const photo = await prisma.galleryPhoto.create({
    data: { imageData, caption: caption || null, uploadedById: req.user.id },
  });
  res.status(201).json(photo);
});

// DELETE /api/gallery/:id - lab staff/admin only
router.delete("/:id", requireAuth, requireRole("ADMIN", "LAB_STAFF"), async (req, res) => {
  await prisma.galleryPhoto.delete({ where: { id: req.params.id } });
  res.json({ message: "Photo deleted" });
});

module.exports = router;