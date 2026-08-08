const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/blog - public, no login required (shown on the Welcome screen)
router.get("/", async (req, res) => {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, imageData: true, createdAt: true, updatedAt: true },
  });
  res.json(posts);
});

// GET /api/blog/:id - public, full post content
router.get("/:id", async (req, res) => {
  const post = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

// POST /api/blog - lab staff/admin only
router.post("/", requireAuth, requireRole("ADMIN", "LAB_STAFF"), async (req, res) => {
  const { title, content, imageData } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required" });
  }
  const post = await prisma.blogPost.create({
    data: { title, content, imageData: imageData || null, authorId: req.user.id },
  });
  res.status(201).json(post);
});

// PUT /api/blog/:id - lab staff/admin only
router.put("/:id", requireAuth, requireRole("ADMIN", "LAB_STAFF"), async (req, res) => {
  const { title, content, imageData } = req.body;
  try {
    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: { title, content, imageData },
    });
    res.json(post);
  } catch (err) {
    res.status(404).json({ error: "Post not found" });
  }
});

// DELETE /api/blog/:id - lab staff/admin only
router.delete("/:id", requireAuth, requireRole("ADMIN", "LAB_STAFF"), async (req, res) => {
  await prisma.blogPost.delete({ where: { id: req.params.id } });
  res.json({ message: "Post deleted" });
});

module.exports = router;