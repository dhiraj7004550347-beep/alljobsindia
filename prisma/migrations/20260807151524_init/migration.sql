-- CreateTable
CREATE TABLE "Job" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "vacancy" TEXT NOT NULL,
    "salary" TEXT NOT NULL,
    "ageLimit" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "applicationFee" TEXT NOT NULL,
    "selectionProcess" TEXT NOT NULL,
    "lastDate" TIMESTAMP(3) NOT NULL,
    "applyLink" TEXT NOT NULL,
    "notificationLink" TEXT NOT NULL,
    "officialWebsite" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);
