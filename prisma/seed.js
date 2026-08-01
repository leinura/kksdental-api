const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  // First admin login - CHANGE THIS PASSWORD after your first login.
  const adminPasswordHash = await bcrypt.hash("ChangeMe123!", 10);
  await prisma.user.upsert({
    where: { email: "admin@kksdental.com" },
    update: {},
    create: {
      name: "KKSDENTAL Admin",
      email: "admin@kksdental.com",
      username: "admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  // Sample catalog so Registration/Billing dropdowns aren't empty on first run.
  const crown = await prisma.service.upsert({
    where: { name: "Crown" },
    update: {},
    create: { name: "Crown" },
  });
  const nightGuard = await prisma.service.upsert({
    where: { name: "Night Guard" },
    update: {},
    create: { name: "Night Guard" },
  });

  const zirconiaCrown = await prisma.serviceType.create({
    data: { name: "Zirconia", serviceId: crown.id },
  });
  const softNightGuard = await prisma.serviceType.create({
    data: { name: "Soft", serviceId: nightGuard.id },
  });

  const sixMonths = await prisma.warranty.upsert({
    where: { label: "6 Months" },
    update: {},
    create: { label: "6 Months" },
  });
  const oneYear = await prisma.warranty.upsert({
    where: { label: "1 Year" },
    update: {},
    create: { label: "1 Year" },
  });

  await prisma.toothShade.createMany({
    data: [{ code: "A1" }, { code: "A2" }, { code: "A3" }, { code: "B1" }],
    skipDuplicates: true,
  });

  await prisma.priceListEntry.upsert({
    where: {
      serviceId_serviceTypeId_warrantyId: {
        serviceId: crown.id,
        serviceTypeId: zirconiaCrown.id,
        warrantyId: oneYear.id,
      },
    },
    update: {},
    create: {
      serviceId: crown.id,
      serviceTypeId: zirconiaCrown.id,
      warrantyId: oneYear.id,
      price: 3500,
    },
  });

  await prisma.priceListEntry.upsert({
    where: {
      serviceId_serviceTypeId_warrantyId: {
        serviceId: nightGuard.id,
        serviceTypeId: softNightGuard.id,
        warrantyId: sixMonths.id,
      },
    },
    update: {},
    create: {
      serviceId: nightGuard.id,
      serviceTypeId: softNightGuard.id,
      warrantyId: sixMonths.id,
      price: 1500,
    },
  });

  console.log("Seed complete. Admin login: admin@kksdental.com / ChangeMe123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
