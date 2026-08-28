-- DropForeignKey
ALTER TABLE "Case" DROP CONSTRAINT "Case_warrantyId_fkey";

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "serviceSubtypeId" TEXT,
ADD COLUMN     "serviceTypeWarrantyId" TEXT,
ALTER COLUMN "warrantyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ServiceType" ADD COLUMN     "usesSteps" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ServiceSubtype" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,

    CONSTRAINT "ServiceSubtype_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTypeWarranty" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,

    CONSTRAINT "ServiceTypeWarranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubtypePriceEntry" (
    "id" TEXT NOT NULL,
    "serviceSubtypeId" TEXT NOT NULL,
    "serviceTypeWarrantyId" TEXT,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SubtypePriceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceStep" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "serviceTypeId" TEXT NOT NULL,

    CONSTRAINT "ServiceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStep" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "serviceStepId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "CaseStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubtypePriceEntry_serviceSubtypeId_serviceTypeWarrantyId_key" ON "SubtypePriceEntry"("serviceSubtypeId", "serviceTypeWarrantyId");

-- AddForeignKey
ALTER TABLE "ServiceSubtype" ADD CONSTRAINT "ServiceSubtype_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTypeWarranty" ADD CONSTRAINT "ServiceTypeWarranty_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtypePriceEntry" ADD CONSTRAINT "SubtypePriceEntry_serviceSubtypeId_fkey" FOREIGN KEY ("serviceSubtypeId") REFERENCES "ServiceSubtype"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtypePriceEntry" ADD CONSTRAINT "SubtypePriceEntry_serviceTypeWarrantyId_fkey" FOREIGN KEY ("serviceTypeWarrantyId") REFERENCES "ServiceTypeWarranty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStep" ADD CONSTRAINT "ServiceStep_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStep" ADD CONSTRAINT "CaseStep_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStep" ADD CONSTRAINT "CaseStep_serviceStepId_fkey" FOREIGN KEY ("serviceStepId") REFERENCES "ServiceStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_serviceSubtypeId_fkey" FOREIGN KEY ("serviceSubtypeId") REFERENCES "ServiceSubtype"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_serviceTypeWarrantyId_fkey" FOREIGN KEY ("serviceTypeWarrantyId") REFERENCES "ServiceTypeWarranty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
