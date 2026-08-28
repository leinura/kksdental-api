const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Computes unitPrice/totalPrice (and any CaseStep records to create) for a
// new order. Three pricing paths, checked in this order:
//
//  1. Step-based (stepIds provided) - e.g. Complete Denture: Special Tray,
//     Teeth Setting per Arch, etc. Clinic picks one or more steps, total is
//     their sum. Used when the chosen ServiceType has usesSteps = true.
//
//  2. Sub-Type + Service-Type-scoped warranty (serviceSubtypeId provided) -
//     e.g. Crown > ALL CERAMIC > Premium Zirconia > 10 Years. Each
//     ServiceType has its own independent warranty list (or none, like
//     METAL), and price varies by the exact Sub-Type.
//
//  3. Legacy Service + ServiceType + Warranty (the original two-level
//     system) - kept fully working for any Service/ServiceType that hasn't
//     been migrated to the newer structure, so historical orders and any
//     simple services stay unaffected.
async function computeOrderPricing({
  serviceId,
  serviceTypeId,
  warrantyId,
  serviceSubtypeId,
  serviceTypeWarrantyId,
  stepIds,
  quantity,
  toothNumbers,
}) {
  const finalQuantity = quantity || (toothNumbers ? toothNumbers.length : 1);

  if (Array.isArray(stepIds) && stepIds.length > 0) {
    const steps = await prisma.serviceStep.findMany({
      where: { id: { in: stepIds }, serviceTypeId },
    });
    if (steps.length !== stepIds.length) {
      throw new Error("One or more selected steps are invalid for this service type");
    }
    const totalPrice = steps.reduce((sum, s) => sum + Number(s.price), 0);
    return {
      unitPrice: totalPrice,
      totalPrice,
      quantity: finalQuantity,
      resolvedSteps: steps.map((s) => ({ serviceStepId: s.id, name: s.name, price: s.price })),
    };
  }

  if (serviceSubtypeId) {
    // Same Prisma limitation as the admin pricing form - findFirst instead
    // of findUnique, since the compound key doesn't accept null even though
    // serviceTypeWarrantyId is an optional column (e.g. METAL, no warranty).
    const entry = await prisma.subtypePriceEntry.findFirst({
      where: { serviceSubtypeId, serviceTypeWarrantyId: serviceTypeWarrantyId || null },
    });
    if (!entry) {
      throw new Error("No price configured for this Service Type / Sub-Type / Warranty combination");
    }
    const unitPrice = Number(entry.price);
    return { unitPrice, totalPrice: unitPrice * finalQuantity, quantity: finalQuantity, resolvedSteps: [] };
  }

  if (!warrantyId) {
    throw new Error("A warranty selection is required for this service");
  }
  const legacyEntry = await prisma.priceListEntry.findUnique({
    where: { serviceId_serviceTypeId_warrantyId: { serviceId, serviceTypeId, warrantyId } },
  });
  if (!legacyEntry) {
    throw new Error("No price configured for this Service / Service Type / Warranty combination");
  }
  const unitPrice = Number(legacyEntry.price);
  return { unitPrice, totalPrice: unitPrice * finalQuantity, quantity: finalQuantity, resolvedSteps: [] };
}

module.exports = { computeOrderPricing };