-- CreateTable
CREATE TABLE "CasePhoto" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasePhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CasePhoto" ADD CONSTRAINT "CasePhoto_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
