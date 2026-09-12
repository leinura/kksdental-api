-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "archLower" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archUpper" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ServiceStep" ADD COLUMN     "perArch" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ServiceType" ADD COLUMN     "tieredBasePrice" DECIMAL(10,2),
ADD COLUMN     "tieredIncrementPrice" DECIMAL(10,2),
ADD COLUMN     "usesArch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usesFdiNumbering" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "usesTieredPricing" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ServiceAddon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "serviceTypeId" TEXT NOT NULL,

    CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAddon" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "serviceAddonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "CaseAddon_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServiceAddon" ADD CONSTRAINT "ServiceAddon_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAddon" ADD CONSTRAINT "CaseAddon_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAddon" ADD CONSTRAINT "CaseAddon_serviceAddonId_fkey" FOREIGN KEY ("serviceAddonId") REFERENCES "ServiceAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
