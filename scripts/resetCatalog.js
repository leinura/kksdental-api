// DESTRUCTIVE - deletes ALL catalog data (Services, Service Types,
// Sub-Types, Service-Type-scoped Warranties, Steps, legacy global
// Warranties, and all Price List entries) so you can rebuild it from
// scratch. Does NOT touch clinics, patients, staff, or anything else.
//
// Safety check: refuses to run if any Case (order) already references the
// catalog, since deleting Services out from under real orders would break
// them. If that happens, use the full resetTestData.js instead, which
// clears orders too.
//
// Run with: node scripts/resetCatalog.js

const { PrismaClient } = require("@prisma/client");
const readline = require("readline");
const prisma = new PrismaClient();

async function confirm() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdin });
  return new Promise((resolve) => {
    rl.question(
      '\nThis will PERMANENTLY delete all Services, Service Types, Sub-Types, Warranties, Steps, and Prices. Clinics, patients, staff, and orders are NOT touched. Type "DELETE" to confirm: ',
      (answer) => {
        rl.close();
        resolve(answer.trim() === "DELETE");
      }
    );
  });
}

async function main() {
  const caseCount = await prisma.case.count();
  if (caseCount > 0) {
    console.log(
      `\nStopped: ${caseCount} order(s) still exist and reference the catalog. Deleting Services would break them.`
    );
    console.log("If those are just test orders you're fine losing too, run scripts/resetTestData.js instead.");
    return;
  }

  const confirmed = await confirm();
  if (!confirmed) {
    console.log("Cancelled - nothing was deleted.");
    return;
  }

  console.log("\nWiping catalog...\n");

  const result = await prisma.$transaction(async (tx) => {
    const counts = {};
    counts.subtypePriceEntries = (await tx.subtypePriceEntry.deleteMany()).count;
    counts.serviceSteps = (await tx.serviceStep.deleteMany()).count;
    counts.serviceSubtypes = (await tx.serviceSubtype.deleteMany()).count;
    counts.serviceTypeWarranties = (await tx.serviceTypeWarranty.deleteMany()).count;
    counts.priceListEntries = (await tx.priceListEntry.deleteMany()).count;
    counts.serviceTypes = (await tx.serviceType.deleteMany()).count;
    counts.services = (await tx.service.deleteMany()).count;
    counts.warranties = (await tx.warranty.deleteMany()).count;
    return counts;
  });

  console.log("Done. Rows deleted:");
  console.table(result);
  console.log("\nToothShades were left intact (not part of the Service hierarchy).");
}

main()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());