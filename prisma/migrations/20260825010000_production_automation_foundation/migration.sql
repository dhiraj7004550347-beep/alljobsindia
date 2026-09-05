-- This migration is additive and preserves every existing Job row.
-- Existing required automation-unknown fields are relaxed to nullable so the
-- collector never has to invent information that is absent from a source.

ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

CREATE TYPE "JobReviewStatus" AS ENUM (
  'REVIEW_REQUIRED',
  'MANUAL_VERIFIED',
  'AUTO_VERIFIED',
  'REJECTED'
);

CREATE TYPE "JobSourceType" AS ENUM (
  'GOVERNMENT',
  'PSU',
  'BANKING',
  'RAILWAY',
  'UNIVERSITY',
  'HOSPITAL',
  'PRIVATE_COMPANY',
  'OTHER_OFFICIAL'
);

CREATE TYPE "SourceParserType" AS ENUM (
  'GENERIC_HTML',
  'GOVERNMENT_HTML',
  'PDF_NOTIFICATION'
);

CREATE TYPE "SourceReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AutomationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "AutomationAction" AS ENUM (
  'DISCOVERED_SOURCE',
  'WOULD_ADD',
  'ADDED',
  'UPDATED',
  'DUPLICATE',
  'EXPIRED',
  'SKIPPED',
  'ERROR'
);

ALTER TABLE "Job"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "department" DROP NOT NULL,
  ALTER COLUMN "qualification" DROP NOT NULL,
  ALTER COLUMN "vacancy" DROP NOT NULL,
  ALTER COLUMN "salary" DROP NOT NULL,
  ALTER COLUMN "ageLimit" DROP NOT NULL,
  ALTER COLUMN "location" DROP NOT NULL,
  ALTER COLUMN "applicationFee" DROP NOT NULL,
  ALTER COLUMN "selectionProcess" DROP NOT NULL,
  ALTER COLUMN "lastDate" DROP NOT NULL,
  ALTER COLUMN "applyLink" DROP NOT NULL,
  ALTER COLUMN "notificationLink" DROP NOT NULL,
  ALTER COLUMN "officialWebsite" DROP NOT NULL,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "howToApply" TEXT,
  ADD COLUMN "importantDates" JSONB,
  ADD COLUMN "applicationStartDate" TIMESTAMP(3),
  ADD COLUMN "sourceId" INTEGER,
  ADD COLUMN "sourceName" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sourceJobId" TEXT,
  ADD COLUMN "sourceHash" TEXT,
  ADD COLUMN "canonicalApplyUrl" TEXT,
  ADD COLUMN "canonicalNoticeUrl" TEXT,
  ADD COLUMN "rawSourceReference" TEXT,
  ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "automationConfidence" DOUBLE PRECISION,
  ADD COLUMN "reviewStatus" "JobReviewStatus" NOT NULL DEFAULT 'MANUAL_VERIFIED',
  ADD COLUMN "automationRunId" INTEGER,
  ADD COLUMN "postedDate" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "expiredAt" TIMESTAMP(3),
  ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "Job"
SET
  "firstSeenAt" = "createdAt",
  "lastSeenAt" = "updatedAt",
  "expiresAt" = "lastDate",
  "publishedAt" = CASE WHEN "status" = 'PUBLISHED' THEN "createdAt" ELSE NULL END;

CREATE TABLE "JobSource" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "startUrl" TEXT NOT NULL,
  "type" "JobSourceType" NOT NULL,
  "category" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "trusted" BOOLEAN NOT NULL DEFAULT false,
  "autoPublish" BOOLEAN NOT NULL DEFAULT false,
  "parserType" "SourceParserType" NOT NULL DEFAULT 'GENERIC_HTML',
  "reviewStatus" "SourceReviewStatus" NOT NULL DEFAULT 'PENDING',
  "discoveredFromUrl" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "lastContentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRun" (
  "id" SERIAL NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "status" "AutomationRunStatus" NOT NULL DEFAULT 'RUNNING',
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "requestedBy" TEXT,
  "sourcesChecked" INTEGER NOT NULL DEFAULT 0,
  "sourcesSucceeded" INTEGER NOT NULL DEFAULT 0,
  "sourcesFailed" INTEGER NOT NULL DEFAULT 0,
  "candidates" INTEGER NOT NULL DEFAULT 0,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "wouldAdd" INTEGER NOT NULL DEFAULT 0,
  "added" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "duplicates" INTEGER NOT NULL DEFAULT 0,
  "expired" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "draftsCreated" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "errorMessage" TEXT,
  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRunItem" (
  "id" SERIAL NOT NULL,
  "runId" INTEGER NOT NULL,
  "sourceId" INTEGER,
  "sourceName" TEXT,
  "candidateTitle" TEXT,
  "action" "AutomationAction" NOT NULL,
  "reason" TEXT,
  "jobId" INTEGER,
  "error" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationRunItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationLock" (
  "key" TEXT NOT NULL,
  "runId" INTEGER,
  "acquiredAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationLock_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "JobAlertSubscription" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailNormalized" TEXT NOT NULL,
  "keywords" JSONB NOT NULL,
  "categories" JSONB NOT NULL,
  "locations" JSONB NOT NULL,
  "qualification" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "verificationToken" TEXT NOT NULL,
  "unsubscribeToken" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobAlertSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "JobSource_startUrl_key" ON "JobSource"("startUrl");
CREATE UNIQUE INDEX "Job_sourceId_sourceJobId_key" ON "Job"("sourceId", "sourceJobId");
CREATE UNIQUE INDEX "JobAlertSubscription_emailNormalized_key" ON "JobAlertSubscription"("emailNormalized");
CREATE UNIQUE INDEX "JobAlertSubscription_verificationToken_key" ON "JobAlertSubscription"("verificationToken");
CREATE UNIQUE INDEX "JobAlertSubscription_unsubscribeToken_key" ON "JobAlertSubscription"("unsubscribeToken");

CREATE INDEX "Job_status_idx" ON "Job"("status");
CREATE INDEX "Job_category_idx" ON "Job"("category");
CREATE INDEX "Job_lastDate_idx" ON "Job"("lastDate");
CREATE INDEX "Job_featured_idx" ON "Job"("featured");
CREATE INDEX "Job_sourceHash_idx" ON "Job"("sourceHash");
CREATE INDEX "Job_sourceUrl_idx" ON "Job"("sourceUrl");
CREATE INDEX "Job_canonicalApplyUrl_idx" ON "Job"("canonicalApplyUrl");
CREATE INDEX "Job_canonicalNoticeUrl_idx" ON "Job"("canonicalNoticeUrl");
CREATE INDEX "Job_reviewStatus_idx" ON "Job"("reviewStatus");
CREATE INDEX "JobSource_enabled_trusted_idx" ON "JobSource"("enabled", "trusted");
CREATE INDEX "JobSource_type_idx" ON "JobSource"("type");
CREATE INDEX "JobSource_reviewStatus_idx" ON "JobSource"("reviewStatus");
CREATE INDEX "JobSource_lastContentHash_idx" ON "JobSource"("lastContentHash");
CREATE INDEX "AutomationRun_startedAt_idx" ON "AutomationRun"("startedAt");
CREATE INDEX "AutomationRun_status_idx" ON "AutomationRun"("status");
CREATE INDEX "AutomationRunItem_runId_action_idx" ON "AutomationRunItem"("runId", "action");
CREATE INDEX "AutomationRunItem_sourceId_idx" ON "AutomationRunItem"("sourceId");
CREATE INDEX "AutomationRunItem_jobId_idx" ON "AutomationRunItem"("jobId");
CREATE INDEX "JobAlertSubscription_active_verifiedAt_idx" ON "JobAlertSubscription"("active", "verifiedAt");
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

ALTER TABLE "Job"
  ADD CONSTRAINT "Job_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Job_automationRunId_fkey"
  FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationRunItem"
  ADD CONSTRAINT "AutomationRunItem_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AutomationRunItem_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AutomationRunItem_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
