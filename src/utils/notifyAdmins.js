const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Fires for every admin/lab-staff device with a registered push token.
// Wrapped so a push failure never breaks the calling request (order/payment
// creation should always succeed even if a push happens to fail).
async function notifyAdmins({ type, message, caseId }) {
  try {
    await prisma.notification.create({ data: { type, message, caseId: caseId || null } });

    const staff = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "LAB_STAFF"] }, pushToken: { not: null } },
      select: { pushToken: true },
    });

    if (staff.length === 0) return;

    const messages = staff.map((s) => ({
      to: s.pushToken,
      sound: "default",
      title: type === "NEW_ORDER" ? "New Order" : "Payment Received",
      body: message,
    }));

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error("notifyAdmins failed:", err);
  }
}

module.exports = { notifyAdmins };