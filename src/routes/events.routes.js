const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// GET /api/events - any logged-in user, newest first, with all photos
router.get("/", async (req, res) => {
  const events = await prisma.event.findMany({
    include: { photos: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(events);
});

// POST /api/events - admin only. photos is an array of base64 data-URI
// strings (can be empty/omitted for a text-only event).
router.post("/", requireRole("ADMIN"), async (req, res) => {
  const { title, description, imageData, link, phone, photos } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title,
        description: description || null,
        imageData: imageData || null,
        link: link || null,
        phone: phone || null,
      },
    });

    if (Array.isArray(photos) && photos.length > 0) {
      await tx.eventPhoto.createMany({
        data: photos.map((imageData) => ({ eventId: created.id, imageData })),
      });
    }

    return tx.event.findUnique({
      where: { id: created.id },
      include: { photos: { orderBy: { createdAt: "asc" } } },
    });
  });

  res.status(201).json(event);
});

// PUT /api/events/:id - admin only. photos, if provided, is treated as the
// FULL desired photo set (existing ones the admin kept, plus any newly
// added) - simplest correct semantics for an edit form, rather than trying
// to diff individual additions/removals. Existing EventPhoto rows are
// replaced wholesale when photos is provided.
router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const { title, description, imageData, link, phone, photos } = req.body;
  try {
    const event = await prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id: req.params.id },
        data: { title, description, imageData, link, phone },
      });

      if (Array.isArray(photos)) {
        await tx.eventPhoto.deleteMany({ where: { eventId: req.params.id } });
        if (photos.length > 0) {
          await tx.eventPhoto.createMany({
            data: photos.map((imageData) => ({ eventId: req.params.id, imageData })),
          });
        }
      }

      return tx.event.findUnique({
        where: { id: req.params.id },
        include: { photos: { orderBy: { createdAt: "asc" } } },
      });
    });
    res.json(event);
  } catch (err) {
    res.status(404).json({ error: "Event not found" });
  }
});

// DELETE /api/events/:id - admin only. EventPhoto rows cascade-delete
// automatically (onDelete: Cascade in the schema).
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.event.delete({ where: { id: req.params.id } });
  res.json({ message: "Event deleted" });
});

module.exports = router;