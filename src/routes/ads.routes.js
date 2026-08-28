const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// GET /api/ads - any logged-in user. Optional ?placement=HERO|SHOP filters
// to just that section; omitted returns everything (used by the admin
// Ads screen, which manages both placements at once).
router.get("/", async (req, res) => {
  const { placement } = req.query;
  const where = placement ? { placement } : {};
  const ads = await prisma.advertisement.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(ads);
});

// POST /api/ads - admin only
router.post("/", requireRole("ADMIN"), async (req, res) => {
  const { imageData, link, placement } = req.body;
  if (!imageData) {
    return res.status(400).json({ error: "Image data is required" });
  }
  const ad = await prisma.advertisement.create({
    data: { imageData, link: link || null, placement: placement === "SHOP" ? "SHOP" : "HERO" },
  });
  res.status(201).json(ad);
});

// DELETE /api/ads/:id - admin only
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.advertisement.delete({ where: { id: req.params.id } });
  res.json({ message: "Ad deleted" });
});

module.exports = router;