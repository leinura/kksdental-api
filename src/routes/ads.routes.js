const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// GET /api/ads - any logged-in user (powers the auto-sliding carousel on
// the client's Home screen)
router.get("/", async (req, res) => {
  const ads = await prisma.advertisement.findMany({ orderBy: { createdAt: "desc" } });
  res.json(ads);
});

// POST /api/ads - admin only
router.post("/", requireRole("ADMIN"), async (req, res) => {
  const { imageData, link } = req.body;
  if (!imageData) {
    return res.status(400).json({ error: "Image data is required" });
  }
  const ad = await prisma.advertisement.create({
    data: { imageData, link: link || null },
  });
  res.status(201).json(ad);
});

// DELETE /api/ads/:id - admin only
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.advertisement.delete({ where: { id: req.params.id } });
  res.json({ message: "Ad deleted" });
});

module.exports = router;