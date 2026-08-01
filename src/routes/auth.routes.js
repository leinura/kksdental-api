const express = require("express");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { signToken } = require("../utils/jwt");

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/login
// One login form for everyone. The role on the returned token/user object
// is what the frontend uses to route to the dentist dashboard or the
// admin/lab-staff dashboard - there is no separate login flow per role.
router.post("/login", async (req, res) => {
  const { emailOrUsername, password } = req.body;

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

module.exports = router;
