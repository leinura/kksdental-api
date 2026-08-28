// DESTRUCTIVE - deletes ALL data except ADMIN user accounts. Run this only
// when you genuinely want to wipe the database back to a clean slate for
// testing (e.g. before a fresh round of QA). There is no undo.
//
// Run with: node scripts/resetTestData.js
//
// Deletion order matters - children must go before the parents they
// reference (foreign keys), so this walks the dependency tree from the
// most-nested tables (CasePhoto, CaseStep) up to the root (Service,
// Clinic, User).

const { PrismaClient } = require("@prisma/client");
const readline = require("readline");
const prisma = new PrismaClient();

async function confirm() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      '\nThis will PERMANENTLY delete all clinics, patients, orders, staff, notifications, catalog data, gallery, blog, ads, and events. Only ADMIN logins survive. Type "DELETE" to confirm: ',
      (answer) => {
        rl.close();
        resolve(answer.trim() === "DELETE");
      }
    );
  });
}

async function main() {
  const confirmed = await confirm();
  if (!confirmed) {
    console.log("Cancelled - nothing was deleted.");
    return;
  }

  console.log("\nWiping data...\n");

  const result = await prisma.$transaction(async (tx) => {
    const counts = {};

    counts.casePhotos = (await tx.casePhoto.deleteMany()).count;
    counts.caseSteps = (await tx.caseStep.deleteMany()).count;
    counts.transactions = (await tx.transaction.deleteMany()).count;
    counts.cases = (await tx.case.deleteMany()).count;
    counts.patients = (await tx.patient.deleteMany()).count;

    counts.subtypePriceEntries = (await tx.subtypePriceEntry.deleteMany()).count;
    counts.serviceSteps = (await tx.serviceStep.deleteMany()).count;
    counts.serviceSubtypes = (await tx.serviceSubtype.deleteMany()).count;
    counts.serviceTypeWarranties = (await tx.serviceTypeWarranty.deleteMany()).count;
    counts.priceListEntries = (await tx.priceListEntry.deleteMany()).count;
    counts.serviceTypes = (await tx.serviceType.deleteMany()).count;
    counts.services = (await tx.service.deleteMany()).count;
    counts.warranties = (await tx.warranty.deleteMany()).count;
    counts.toothShades = (await tx.toothShade.deleteMany()).count;

    counts.notifications = (await tx.notification.deleteMany()).count;
    counts.galleryPhotos = (await tx.galleryPhoto.deleteMany()).count;
    counts.blogPosts = (await tx.blogPost.deleteMany()).count;
    counts.advertisements = (await tx.advertisement.deleteMany()).count;
    counts.events = (await tx.event.deleteMany()).count;

    counts.loginActivities = (await tx.loginActivity.deleteMany()).count;
    counts.clinics = (await tx.clinic.deleteMany()).count;
    counts.nonAdminUsers = (await tx.user.deleteMany({ where: { role: { not: "ADMIN" } } })).count;

    return counts;
  });

  console.log("Done. Rows deleted:");
  console.table(result);

  const remainingAdmins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { name: true, username: true, email: true },
  });
  console.log("\nRemaining ADMIN logins:");
  console.table(remainingAdmins);
}

main()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());