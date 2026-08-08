const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth, requireRole("ADMIN", "LAB_STAFF"));

// GET /api/notifications - recent feed, newest first
router.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
});

// GET /api/notifications/unread-count - for the bell badge
router.get("/unread-count", async (req, res) => {
  const count = await prisma.notification.count({ where: { read: false } });
  res.json({ count });
});

// PATCH /api/notifications/mark-read - marks everything read at once
router.patch("/mark-read", async (req, res) => {
  await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
  res.json({ message: "Marked as read" });
});

module.exports = router;