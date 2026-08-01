const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// NOTE: Uses a simple count-based sequence. This is fine for a single-lab,
// moderate-volume app, but under high concurrent writes two requests could
// theoretically read the same count before either insert completes. If that
// ever becomes a real issue, swap this for a dedicated Postgres sequence or
// a counter row updated inside the transaction.

async function generatePatientCode() {
  const count = await prisma.patient.count();
  const next = count + 1;
  return `PT-${String(next).padStart(3, "0")}`;
}

async function generateCaseCode() {
  const count = await prisma.case.count();
  const next = count + 1;
  return `ORD-${String(next).padStart(4, "0")}`;
}

module.exports = { generatePatientCode, generateCaseCode };
