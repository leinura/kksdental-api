/*
  Warnings:

  - The values [ONLINE,MANUAL] on the enum `TransactionMethod` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionMethod_new" AS ENUM ('CASH', 'UPI');
ALTER TABLE "Transaction" ALTER COLUMN "method" TYPE "TransactionMethod_new" USING ("method"::text::"TransactionMethod_new");
ALTER TYPE "TransactionMethod" RENAME TO "TransactionMethod_old";
ALTER TYPE "TransactionMethod_new" RENAME TO "TransactionMethod";
DROP TYPE "TransactionMethod_old";
COMMIT;

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
