const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// GET routes are open to any logged-in user, since dentists need these
// lists to populate the Patient Registration / Billing dropdowns.
router.use(requireAuth);

// Deeply nested: each ServiceType now carries its own Sub-Types (with their
// prices), its own Service-Type-scoped Warranties, and its own Steps (for
// usesSteps ServiceTypes) - everything the order form needs in one call.
router.get("/services", async (req, res) => {
  const services = await prisma.service.findMany({
    include: {
      serviceTypes: {
        include: {
          subtypes: { include: { priceEntries: true } },
          typeWarranties: true,
          steps: true,
        },
      },
    },
  });
  res.json(services);
});

router.get("/warranties", async (req, res) => {
  res.json(await prisma.warranty.findMany());
});

router.get("/tooth-shades", async (req, res) => {
  res.json(await prisma.toothShade.findMany());
});

router.get("/price-list", async (req, res) => {
  res.json(
    await prisma.priceListEntry.findMany({
      include: { service: true, serviceType: true, warranty: true },
    })
  );
});

// Everything below is admin-only catalog management.
router.use(requireRole("ADMIN"));

router.post("/services", async (req, res) => {
  const service = await prisma.service.create({ data: { name: req.body.name } });
  res.status(201).json(service);
});

router.post("/service-types", async (req, res) => {
  const { name, serviceId } = req.body;
  const serviceType = await prisma.serviceType.create({ data: { name, serviceId } });
  res.status(201).json(serviceType);
});

// PUT /api/catalog/service-types/:id - toggle whether this Service Type
// uses step-based pricing (Complete Denture style) instead of the
// Sub-Type/Warranty or legacy Warranty pricing.
router.put("/service-types/:id", async (req, res) => {
  const { name, usesSteps } = req.body;
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (usesSteps !== undefined) data.usesSteps = usesSteps;
    const serviceType = await prisma.serviceType.update({ where: { id: req.params.id }, data });
    res.json(serviceType);
  } catch (err) {
    res.status(404).json({ error: "Service type not found" });
  }
});

router.post("/warranties", async (req, res) => {
  const warranty = await prisma.warranty.create({ data: { label: req.body.label } });
  res.status(201).json(warranty);
});

router.post("/tooth-shades", async (req, res) => {
  const shade = await prisma.toothShade.create({ data: { code: req.body.code } });
  res.status(201).json(shade);
});

router.post("/price-list", async (req, res) => {
  const { serviceId, serviceTypeId, warrantyId, price } = req.body;
  const entry = await prisma.priceListEntry.upsert({
    where: { serviceId_serviceTypeId_warrantyId: { serviceId, serviceTypeId, warrantyId } },
    update: { price },
    create: { serviceId, serviceTypeId, warrantyId, price },
  });
  res.status(201).json(entry);
});

// --- Sub-Types (e.g. "Premium Zirconia" under Crown > ALL CERAMIC) ---

router.post("/service-subtypes", async (req, res) => {
  const { name, serviceTypeId } = req.body;
  if (!name || !serviceTypeId) {
    return res.status(400).json({ error: "name and serviceTypeId are required" });
  }
  const subtype = await prisma.serviceSubtype.create({ data: { name, serviceTypeId } });
  res.status(201).json(subtype);
});

router.delete("/service-subtypes/:id", async (req, res) => {
  try {
    await prisma.serviceSubtype.delete({ where: { id: req.params.id } });
    res.json({ message: "Sub-type deleted" });
  } catch (err) {
    res.status(400).json({ error: "Can't delete - this sub-type has prices or cases linked to it" });
  }
});

// --- Service-Type-scoped Warranties (e.g. ALL CERAMIC's own 5/10/15 Year options) ---

router.post("/service-type-warranties", async (req, res) => {
  const { label, serviceTypeId } = req.body;
  if (!label || !serviceTypeId) {
    return res.status(400).json({ error: "label and serviceTypeId are required" });
  }
  const warranty = await prisma.serviceTypeWarranty.create({ data: { label, serviceTypeId } });
  res.status(201).json(warranty);
});

router.delete("/service-type-warranties/:id", async (req, res) => {
  try {
    await prisma.serviceTypeWarranty.delete({ where: { id: req.params.id } });
    res.json({ message: "Warranty deleted" });
  } catch (err) {
    res.status(400).json({ error: "Can't delete - this warranty has prices or cases linked to it" });
  }
});

// --- Sub-Type x Warranty prices ---
// serviceTypeWarrantyId may be omitted/null for Service Types with no
// warranty at all (like METAL) - price is then keyed on Sub-Type alone.

router.post("/subtype-price-list", async (req, res) => {
  const { serviceSubtypeId, serviceTypeWarrantyId, price } = req.body;
  if (!serviceSubtypeId || price == null) {
    return res.status(400).json({ error: "serviceSubtypeId and price are required" });
  }
  // Prisma's compound-unique upsert/findUnique doesn't accept null for an
  // optional field in the key, even though the column itself is nullable -
  // findFirst + manual create/update sidesteps that limitation.
  const warrantyId = serviceTypeWarrantyId || null;
  const existing = await prisma.subtypePriceEntry.findFirst({
    where: { serviceSubtypeId, serviceTypeWarrantyId: warrantyId },
  });

  const entry = existing
    ? await prisma.subtypePriceEntry.update({ where: { id: existing.id }, data: { price } })
    : await prisma.subtypePriceEntry.create({ data: { serviceSubtypeId, serviceTypeWarrantyId: warrantyId, price } });

  res.status(201).json(entry);
});

router.delete("/subtype-price-list/:id", async (req, res) => {
  await prisma.subtypePriceEntry.delete({ where: { id: req.params.id } });
  res.json({ message: "Price entry deleted" });
});

// --- Steps (e.g. "Special Tray", "Teeth Setting per Arch" under Complete Denture) ---

router.post("/service-steps", async (req, res) => {
  const { name, price, serviceTypeId } = req.body;
  if (!name || price == null || !serviceTypeId) {
    return res.status(400).json({ error: "name, price, and serviceTypeId are required" });
  }
  const step = await prisma.serviceStep.create({ data: { name, price, serviceTypeId } });
  res.status(201).json(step);
});

router.put("/service-steps/:id", async (req, res) => {
  const { name, price } = req.body;
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (price !== undefined) data.price = price;
    const step = await prisma.serviceStep.update({ where: { id: req.params.id }, data });
    res.json(step);
  } catch (err) {
    res.status(404).json({ error: "Step not found" });
  }
});

router.delete("/service-steps/:id", async (req, res) => {
  try {
    await prisma.serviceStep.delete({ where: { id: req.params.id } });
    res.json({ message: "Step deleted" });
  } catch (err) {
    res.status(400).json({ error: "Can't delete - this step has cases linked to it" });
  }
});

// --- Existing entities ---

router.delete("/services/:id", async (req, res) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ message: "Service deleted" });
  } catch (err) {
    res.status(400).json({ error: "Can't delete - this service has service types or cases linked to it" });
  }
});

router.delete("/service-types/:id", async (req, res) => {
  try {
    await prisma.serviceType.delete({ where: { id: req.params.id } });
    res.json({ message: "Service type deleted" });
  } catch (err) {
    res.status(400).json({ error: "Can't delete - this service type has cases linked to it" });
  }
});

router.delete("/warranties/:id", async (req, res) => {
  try {
    await prisma.warranty.delete({ where: { id: req.params.id } });
    res.json({ message: "Warranty deleted" });
  } catch (err) {
    res.status(400).json({ error: "Can't delete - this warranty has cases linked to it" });
  }
});

router.delete("/tooth-shades/:id", async (req, res) => {
  try {
    await prisma.toothShade.delete({ where: { id: req.params.id } });
    res.json({ message: "Tooth shade deleted" });
  } catch (err) {
    res.status(400).json({ error: "Can't delete - this shade has cases linked to it" });
  }
});

router.delete("/price-list/:id", async (req, res) => {
  await prisma.priceListEntry.delete({ where: { id: req.params.id } });
  res.json({ message: "Price entry deleted" });
});

module.exports = router;