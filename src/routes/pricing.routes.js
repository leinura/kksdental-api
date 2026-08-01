const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// GET routes are open to any logged-in user, since dentists need these
// lists to populate the Patient Registration / Billing dropdowns.
router.use(requireAuth);

router.get("/services", async (req, res) => {
  const services = await prisma.service.findMany({ include: { serviceTypes: true } });
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

module.exports = router;
