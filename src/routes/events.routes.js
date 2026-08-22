const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// GET /api/events - any logged-in user, newest first
router.get("/", async (req, res) => {
  const events = await prisma.event.findMany({ orderBy: { createdAt: "desc" } });
  res.json(events);
});

// POST /api/events - admin only
router.post("/", requireRole("ADMIN"), async (req, res) => {
  const { title, description, imageData, link, phone } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }
  const event = await prisma.event.create({
    data: {
      title,
      description: description || null,
      imageData: imageData || null,
      link: link || null,
      phone: phone || null,
    },
  });
  res.status(201).json(event);
});

// PUT /api/events/:id - admin only
router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const { title, description, imageData, link, phone } = req.body;
  try {
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { title, description, imageData, link, phone },
    });
    res.json(event);
  } catch (err) {
    res.status(404).json({ error: "Event not found" });
  }
});

// DELETE /api/events/:id - admin only
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.event.delete({ where: { id: req.params.id } });
  res.json({ message: "Event deleted" });
});

module.exports = router;