const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Computes unitPrice/totalPrice/quantity (and any CaseStep/CaseAddon records
// to create) for a new order. A Service Type's own configuration decides
// both how quantity is determined AND which pricing path applies - the two
// are independent settings, checked in this order:
//
// QUANTITY SOURCE:
//   - usesArch: quantity = number of arches selected (Upper/Lower, 1 or 2).
//     At least one arch must be selected.
//   - usesFdiNumbering (default true): quantity = number of FDI tooth
//     numbers selected, or a manual override.
//   - neither: flat one-off item, quantity defaults to 1 (or a manual
//     override) - e.g. a habit-breaking appliance that isn't priced per
//     tooth or per arch.
//
// PRICING PATH (checked in this order, expected to be mutually exclusive
// per Service Type in practice):
//   1. usesSteps - sum of selected Steps. A Step's own perArch flag decides
//      whether ITS price multiplies by the arch count (e.g. "Teeth Setting
//      Per Arch" doubles when both arches are picked) or stays flat
//      regardless (e.g. "Special Tray", a one-time cost either way).
//   2. usesTieredPricing - basePrice covers the first unit, incrementPrice
//      is added per additional unit beyond that (e.g. RPD: 350 for the
//      first tooth, +50 per additional tooth).
//   3. Sub-Type + Service-Type-scoped Warranty (or no warranty, like METAL).
//   4. Legacy Service + ServiceType + Warranty (the original system).
//
// ADD-ONS: layered on top of whichever path above computed the base total -
// each selected add-on's price is multiplied by quantity and added on
// (e.g. "+200 per crown" for a gingival extension), independent of which
// pricing path was used underneath.
async function computeOrderPricing({
  serviceId,
  serviceTypeId,
  warrantyId,
  serviceSubtypeId,
  serviceTypeWarrantyId,
  stepIds,
  addonIds,
  quantity,
  toothNumbers,
  archUpper,
  archLower,
}) {
  const serviceType = await prisma.serviceType.findUnique({ where: { id: serviceTypeId } });
  if (!serviceType) {
    throw new Error("Service type not found");
  }

  // --- Quantity source ---
  let finalQuantity;
  if (serviceType.usesArch) {
    finalQuantity = (archUpper ? 1 : 0) + (archLower ? 1 : 0);
    if (finalQuantity === 0) {
      throw new Error("Select at least one arch (Upper or Lower)");
    }
  } else if (serviceType.usesFdiNumbering) {
    finalQuantity = quantity || (toothNumbers ? toothNumbers.length : 1);
  } else {
    finalQuantity = quantity || 1;
  }

  // --- Base pricing path ---
  let unitPrice = null;
  let totalPrice = null;
  let resolvedSteps = [];

  if (serviceType.usesSteps) {
    const steps = await prisma.serviceStep.findMany({
      where: { id: { in: stepIds || [] }, serviceTypeId },
    });
    if (!stepIds || steps.length !== stepIds.length) {
      throw new Error("One or more selected steps are invalid for this service type");
    }
    totalPrice = steps.reduce((sum, s) => {
      const linePrice = s.perArch ? Number(s.price) * finalQuantity : Number(s.price);
      return sum + linePrice;
    }, 0);
    unitPrice = totalPrice;
    resolvedSteps = steps.map((s) => ({
      serviceStepId: s.id,
      name: s.perArch ? `${s.name} (x${finalQuantity})` : s.name,
      price: s.perArch ? Number(s.price) * finalQuantity : Number(s.price),
    }));
  } else if (serviceType.usesTieredPricing) {
    if (serviceType.tieredBasePrice == null || serviceType.tieredIncrementPrice == null) {
      throw new Error("Tiered pricing is not fully configured for this service type");
    }
    const base = Number(serviceType.tieredBasePrice);
    const increment = Number(serviceType.tieredIncrementPrice);
    totalPrice = base + Math.max(0, finalQuantity - 1) * increment;
    unitPrice = totalPrice;
  } else if (serviceSubtypeId) {
    // findFirst, not findUnique - Prisma's compound-unique lookup doesn't
    // accept null for an optional key field, even though the column is
    // nullable (e.g. METAL has no warranty at all).
    const entry = await prisma.subtypePriceEntry.findFirst({
      where: { serviceSubtypeId, serviceTypeWarrantyId: serviceTypeWarrantyId || null },
    });
    if (!entry) {
      throw new Error("No price configured for this Service Type / Sub-Type / Warranty combination");
    }
    unitPrice = Number(entry.price);
    totalPrice = unitPrice * finalQuantity;
  } else {
    if (!warrantyId) {
      throw new Error("A warranty selection is required for this service");
    }
    const legacyEntry = await prisma.priceListEntry.findUnique({
      where: { serviceId_serviceTypeId_warrantyId: { serviceId, serviceTypeId, warrantyId } },
    });
    if (!legacyEntry) {
      throw new Error("No price configured for this Service / Service Type / Warranty combination");
    }
    unitPrice = Number(legacyEntry.price);
    totalPrice = unitPrice * finalQuantity;
  }

  // --- Add-ons, layered on top ---
  let resolvedAddons = [];
  if (Array.isArray(addonIds) && addonIds.length > 0) {
    const addons = await prisma.serviceAddon.findMany({
      where: { id: { in: addonIds }, serviceTypeId },
    });
    if (addons.length !== addonIds.length) {
      throw new Error("One or more selected add-ons are invalid for this service type");
    }
    resolvedAddons = addons.map((a) => ({
      serviceAddonId: a.id,
      name: a.name,
      price: Number(a.price) * finalQuantity,
    }));
    totalPrice += resolvedAddons.reduce((sum, a) => sum + a.price, 0);
  }

  return {
    unitPrice,
    totalPrice,
    quantity: finalQuantity,
    resolvedSteps,
    resolvedAddons,
  };
}

module.exports = { computeOrderPricing };