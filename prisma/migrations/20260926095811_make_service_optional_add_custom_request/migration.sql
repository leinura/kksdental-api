-- DropForeignKey
ALTER TABLE "Case" DROP CONSTRAINT "Case_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Case" DROP CONSTRAINT "Case_serviceTypeId_fkey";

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "customRequestNote" TEXT,
ALTER COLUMN "serviceId" DROP NOT NULL,
ALTER COLUMN "serviceTypeId" DROP NOT NULL,
ALTER COLUMN "unitPrice" DROP NOT NULL,
ALTER COLUMN "totalPrice" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
