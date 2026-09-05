import type {
  JobSource,
  JobSourceType,
  SourceParserType,
} from "@prisma/client";

export type ImportantDate = {
  label: string;
  value: string;
};

export type CollectedJob = {
  title: string;
  department?: string | null;
  qualification?: string | null;
  vacancy?: string | null;
  salary?: string | null;
  ageLimit?: string | null;
  location?: string | null;
  applicationFee?: string | null;
  selectionProcess?: string | null;
  description?: string | null;
  howToApply?: string | null;
  importantDates?: ImportantDate[];
  applicationStartDate?: string | null;
  lastDate?: string | null;
  applyLink?: string | null;
  notificationLink?: string | null;
  officialWebsite?: string | null;
  sourceJobId?: string | null;
  sourceUrl: string;
  postedDate?: string | null;
  updatedDate?: string | null;
  rawText: string;
  contentHash: string;
  isCorrigendum?: boolean;
  extractionMethod: "JSON_LD" | "HTML" | "PDF" | "AI";
};

export type DiscoveredSource = {
  name: string;
  domain: string;
  startUrl: string;
  type: JobSourceType;
  category: string;
  parserType: SourceParserType;
  discoveredFromUrl: string;
};

export type AdapterResult = {
  jobs: CollectedJob[];
  discoveredSources: DiscoveredSource[];
  contentHash?: string;
  metrics?: CollectionMetrics;
  warnings?: string[];
};

/** Link-level collection facts.  These are deliberately separate from jobs. */
export type CollectionMetrics = {
  rawLinks: number;
  recruitmentLinks: number;
  uniqueNotices: number;
  rejectedNoise: number;
};

export interface SourceAdapter {
  name: string;
  canHandle(source: JobSource): boolean;
  collect(source: JobSource): Promise<AdapterResult>;
}

export type SourceCollectionResult = {
  source: JobSource;
  jobs: CollectedJob[];
  discoveredSources: DiscoveredSource[];
  succeeded: boolean;
  durationMs: number;
  contentHash?: string;
  metrics: CollectionMetrics;
  warnings: string[];
  error?: string;
};

export type ValidationResult = {
  job: CollectedJob;
  confidence: number;
  reasons: string[];
  highConfidence: boolean;
  eligibleForAutoPublish: boolean;
};

export type AutomationRunSummary = {
  id: number;
  startedAt: string;
  completedAt?: string;
  status: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  dryRun: boolean;
  durationMs?: number;
  sourcesChecked: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  candidates: number;
  rawLinks: number;
  recruitmentLinks: number;
  uniqueNotices: number;
  parsedJobs: number;
  rejected: number;
  lowConfidence: number;
  processed: number;
  wouldAdd: number;
  /** Explicit alias for the persistent-database update count. */
  wouldUpdate: number;
  added: number;
  updated: number;
  duplicates: number;
  expired: number;
  skipped: number;
  errors: number;
  draftsCreated: number;
  previewJobs: PreviewJob[];
};

export type PreviewJob = Pick<CollectedJob,
  "title" | "department" | "qualification" | "vacancy" | "salary" |
  "ageLimit" | "location" | "applicationFee" | "selectionProcess" |
  "applicationStartDate" | "lastDate" | "applyLink" | "notificationLink" |
  "officialWebsite" | "sourceUrl"
> & {
  sourceId: number;
  sourceName: string;
  candidateKey: string;
  snapshotHash: string;
  confidence: number;
  action: "WOULD_ADD" | "WOULD_UPDATE" | "DUPLICATE" | "REJECTED" | "LOW_CONFIDENCE" | "EXPIRED" | "ADDED" | "UPDATED";
  reason: string;
};

export type ManualReviewEligibility = {
  allowed: boolean;
  reason: string;
};

export type RunAutomationOptions = {
  dryRun?: boolean;
  sourceIds?: number[];
  requestedBy?: string;
};

export type SourceTestSummary = Omit<AutomationRunSummary, "id" | "startedAt" | "completedAt" | "status" | "dryRun" | "durationMs" | "added" | "draftsCreated"> & {
  access: "ACCESSIBLE" | "BLOCKED_OR_FAILED";
  warnings: string[];
};
