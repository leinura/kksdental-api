-- CreateEnum
CREATE TYPE "AdPlacement" AS ENUM ('HERO', 'SHOP');

-- AlterTable
ALTER TABLE "Advertisement" ADD COLUMN     "placement" "AdPlacement" NOT NULL DEFAULT 'HERO';
