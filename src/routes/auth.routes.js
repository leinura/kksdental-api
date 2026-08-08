const express = require("express");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { signToken } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/login
// One login form for everyone. The role on the returned token/user object
// is what the frontend uses to route to the dentist dashboard or the
// admin/lab-staff dashboard - there is no separate login flow per role.
router.post("/login", async (req, res) => {
  const { emailOrUsername, password, deviceInfo } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({ error: "Email/username and password are required" });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
      include: { clinic: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Fire-and-forget - a logging failure should never block a successful login.
    prisma.loginActivity
      .create({ data: { userId: user.id, ipAddress: req.ip, deviceInfo: deviceInfo || null } })
      .catch((err) => console.error("Failed to record login activity:", err));

    const tokenPayload = {
      id: user.id,
      role: user.role,
      name: user.name,
      clinicId: user.clinic ? user.clinic.id : null,
    };

    const token = signToken(tokenPayload);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinic: user.clinic || null,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// GET /api/auth/login-activity - Security screen: recent logins for the current user
router.get("/login-activity", requireAuth, async (req, res) => {
  const activity = await prisma.loginActivity.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json(activity);
});

// PATCH /api/auth/me - admin/lab staff edit their own name/email/username
router.patch("/me", requireAuth, async (req, res) => {
  const { name, email, username } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, email, username },
      include: { clinic: true },
    });
    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      clinic: updated.clinic || null,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "That email or username is already in use" });
    }
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PATCH /api/auth/change-password - any logged-in user changes their own password.
router.patch("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentMatches) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newPasswordHash } });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to update password" });
  }
});

// PATCH /api/auth/push-token - register this device's Expo push token
router.patch("/push-token", requireAuth, async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) {
    return res.status(400).json({ error: "pushToken is required" });
  }
  await prisma.user.update({ where: { id: req.user.id }, data: { pushToken } });
  res.json({ message: "Push token registered" });
});

module.exports = router;