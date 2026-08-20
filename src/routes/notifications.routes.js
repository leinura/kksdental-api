const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth, requireRole("ADMIN", "LAB_STAFF"));

// caseId on Notification is a plain field (not a formal Prisma relation),
// so pull each linked case's comment in a single follow-up query rather
// than an include, and attach it to each notification before returning.
async function attachComments(notifications) {
  const caseIds = notifications.map((n) => n.caseId).filter(Boolean);
  if (caseIds.length === 0) return notifications;

  const cases = await prisma.case.findMany({
    where: { id: { in: caseIds } },
    select: { id: true, comment: true },
  });
  const commentById = Object.fromEntries(cases.map((c) => [c.id, c.comment]));

  return notifications.map((n) => ({ ...n, comment: n.caseId ? commentById[n.caseId] || null : null }));
}

// GET /api/notifications - recent feed, newest first
router.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(await attachComments(notifications));
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