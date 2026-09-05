"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Source = {
  id: number;
  name: string;
  domain: string;
  enabled: boolean;
  trusted: boolean;
  autoPublish: boolean;
  reviewStatus: string;
};

type PreviewJob = {
  title: string;
  department?: string | null;
  qualification?: string | null;
  vacancy?: string | null;
  salary?: string | null;
  ageLimit?: string | null;
  location?: string | null;
  applicationFee?: string | null;
  selectionProcess?: string | null;
  applicationStartDate?: string | null;
  lastDate?: string | null;
  applyLink?: string | null;
  notificationLink?: string | null;
  officialWebsite?: string | null;
  sourceUrl: string;
  sourceId: number;
  sourceName: string;
  candidateKey: string;
  snapshotHash: string;
  confidence: number;
  action: "WOULD_ADD" | "WOULD_UPDATE" | "DUPLICATE" | "REJECTED" | "LOW_CONFIDENCE" | "EXPIRED" | "ADDED" | "UPDATED";
  reason: string;
};

type SourceTest = {
  access: string;
  rawLinks: number;
  recruitmentLinks: number;
  uniqueNotices: number;
  parsedJobs: number;
  wouldAdd: number;
  updated: number;
  wouldUpdate?: number;
  duplicates: number;
  rejected: number;
  lowConfidence: number;
  expired: number;
  errors: number;
  warnings: string[];
  previewJobs: PreviewJob[];
};

type SafetyStatus = {
  dryRun: boolean;
  autoPublish: boolean;
  writeRunsEnabled: boolean;
  manualDraftsEnabled: boolean;
  reviewDecisionsEnabled: boolean;
};

const filters = [
  "ALL",
  "WOULD_ADD",
  "WOULD_UPDATE",
  "DUPLICATE",
  "LOW_CONFIDENCE",
  "REJECTED",
  "EXPIRED",
] as const;

export default function ManualReviewPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState<SafetyStatus | null>(null);
  const [result, setResult] = useState<SourceTest | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]>("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [sourceResponse, statusResponse] = await Promise.all([
      fetch("/api/admin/sources", { cache: "no-store" }),
      fetch("/api/automation/status", { cache: "no-store" }),
    ]);
    const sourceBody = await sourceResponse.json();
    const statusBody = await statusResponse.json();
    if (!sourceResponse.ok) throw new Error(sourceBody.error || "Unable to load sources");
    if (!statusResponse.ok) throw new Error(statusBody.error || "Unable to load safety status");
    const nextSources = (sourceBody.sources || []) as Source[];
    setSources(nextSources);
    setSelectedId((current) => current || nextSources[0]?.id || null);
    setStatus(statusBody);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load review center"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function inspect(sourceId = selectedId) {
    if (!sourceId) return;
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch(`/api/admin/sources/${sourceId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Source inspection failed");
      setResult(body.result);
      setMessage("Read-only inspection finished. No Job, source or automation-run row was written.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Source inspection failed");
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(job: PreviewJob) {
    if (!status?.manualDraftsEnabled || job.action !== "WOULD_ADD") return;
    if (!window.confirm(`Create one unpublished DRAFT for “${job.title}”? This will not publish the job.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/review/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: job.sourceId,
          candidateKey: job.candidateKey,
          snapshotHash: job.snapshotHash,
          confirmation: "CREATE_DRAFT",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Draft creation failed");
      setMessage(body.result.created
        ? `Draft Job #${body.result.jobId} created. It was not published.`
        : body.result.reason);
      await inspect(job.sourceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDecision(job: PreviewJob, decision: "REJECTED" | "NEEDS_CORRECTION") {
    if (!status?.reviewDecisionsEnabled) return;
    const reason = window.prompt(
      decision === "REJECTED"
        ? "Why should this exact source snapshot be rejected?"
        : "What must be corrected before this source snapshot can be accepted?"
    )?.trim();
    if (!reason) return;
    if (reason.length < 10) {
      setMessage("Please enter a specific review reason of at least 10 characters.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/review/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: job.sourceId,
          candidateKey: job.candidateKey,
          snapshotHash: job.snapshotHash,
          decision,
          reason,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Review decision failed");
      setMessage(`${decision} decision saved to the persistent automation audit log. No Job or source changed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review decision failed");
    } finally {
      setBusy(false);
    }
  }

  const visibleJobs = useMemo(
    () => (result?.previewJobs || []).filter((job) => filter === "ALL" || job.action === filter),
    [filter, result]
  );

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manual Review Center</h1>
        <p className="mt-2 text-gray-600">
          Inspect current official-source notices without writing a Job, source health record or automation run.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Safety locks</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Lock label="Default automation" value={status?.dryRun ? "DRY RUN" : "WRITE MODE"} safe={status?.dryRun !== false} />
          <Lock label="Bulk writes" value={status?.writeRunsEnabled ? "ENABLED" : "LOCKED"} safe={!status?.writeRunsEnabled} />
          <Lock label="Manual drafts" value={status?.manualDraftsEnabled ? "ENABLED" : "LOCKED"} safe={!status?.manualDraftsEnabled} />
          <Lock label="Auto-publish" value={status?.autoPublish ? "ENABLED" : "OFF"} safe={!status?.autoPublish} />
        </div>
        <p className="mt-4 text-sm text-gray-600">
          A read-only inspection is always available. Draft creation and persistent decisions require separate server environment switches; publishing is never performed by this page.
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[280px] flex-1">
            <span className="mb-2 block font-semibold">Official source</span>
            <select
              className="input"
              value={selectedId ?? ""}
              onChange={(event) => {
                setSelectedId(Number(event.target.value));
                setResult(null);
              }}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} · {source.enabled ? "Enabled" : "Disabled"} · {source.trusted ? "Trusted" : "Untrusted"}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !selectedId}
            onClick={() => void inspect()}
            className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? "Inspecting…" : "Load Read-only Review"}
          </button>
        </div>
        {message && <p className="mt-4 rounded-lg border bg-slate-50 p-3 text-sm font-semibold">{message}</p>}
      </section>

      {result && (
        <>
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              <Metric label="Access" value={result.access} />
              <Metric label="Raw links" value={result.rawLinks} />
              <Metric label="Recruitment links" value={result.recruitmentLinks} />
              <Metric label="Unique notices" value={result.uniqueNotices} />
              <Metric label="Parsed jobs" value={result.parsedJobs} />
              <Metric label="Would add" value={result.wouldAdd} />
              <Metric label="Would update" value={result.wouldUpdate ?? result.updated} />
              <Metric label="Duplicates" value={result.duplicates} />
              <Metric label="Rejected / noise" value={result.rejected} />
              <Metric label="Low confidence" value={result.lowConfidence} />
              <Metric label="Expired" value={result.expired} />
              <Metric label="Errors" value={result.errors} />
            </div>
            {result.warnings.length > 0 && (
              <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <summary className="cursor-pointer font-bold">Parser warnings ({result.warnings.length})</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                </ul>
              </details>
            )}
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {filters.map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-3 py-2 text-xs font-bold ${filter === value ? "bg-slate-900 text-white" : "bg-white"}`}
                >
                  {value} ({value === "ALL" ? result.previewJobs.length : result.previewJobs.filter((job) => job.action === value).length})
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-5">
              {visibleJobs.map((job) => (
                <CandidateCard
                  key={`${job.candidateKey}:${job.snapshotHash}`}
                  job={job}
                  busy={busy}
                  draftEnabled={status?.manualDraftsEnabled === true}
                  decisionsEnabled={status?.reviewDecisionsEnabled === true}
                  onDraft={() => void createDraft(job)}
                  onDecision={(decision) => void saveDecision(job, decision)}
                />
              ))}
              {visibleJobs.length === 0 && <p className="py-8 text-center text-gray-500">No notices match this filter.</p>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function CandidateCard({
  job,
  busy,
  draftEnabled,
  decisionsEnabled,
  onDraft,
  onDecision,
}: {
  job: PreviewJob;
  busy: boolean;
  draftEnabled: boolean;
  decisionsEnabled: boolean;
  onDraft: () => void;
  onDecision: (decision: "REJECTED" | "NEEDS_CORRECTION") => void;
}) {
  const fields: Array<[string, string | null | undefined]> = [
    ["Department / Company", job.department],
    ["Qualification", job.qualification],
    ["Vacancies", job.vacancy],
    ["Salary / Pay Scale", job.salary],
    ["Age Limit", job.ageLimit],
    ["Location", job.location],
    ["Application Fee", job.applicationFee],
    ["Selection Process", job.selectionProcess],
    ["Application Start Date", job.applicationStartDate],
    ["Last Date", job.lastDate],
  ];
  return (
    <article className="rounded-xl border p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{job.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{job.sourceName} · {Math.round(job.confidence * 100)}% confidence</p>
        </div>
        <span className="h-fit rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">{job.action}</span>
      </div>
      <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">{job.reason}</p>
      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm">{value || "Not specified"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-blue-700">
        <OfficialLink label="Apply Link" url={job.applyLink} />
        <OfficialLink label="Notification Link" url={job.notificationLink} />
        <OfficialLink label="Official Website" url={job.officialWebsite} />
        <OfficialLink label="Source URL" url={job.sourceUrl} />
      </div>
      <p className="mt-3 break-all text-xs text-gray-400">Review identity: {job.candidateKey.slice(0, 16)}… · Snapshot: {job.snapshotHash.slice(0, 16)}…</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {job.action === "WOULD_ADD" && (
          <button
            disabled={busy || !draftEnabled}
            onClick={onDraft}
            title={draftEnabled ? "Create one unpublished draft" : "Locked by AUTOMATION_ALLOW_MANUAL_DRAFTS"}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {draftEnabled ? "Approve as Draft" : "Draft Creation Locked"}
          </button>
        )}
        <button
          disabled={busy || !decisionsEnabled}
          onClick={() => onDecision("NEEDS_CORRECTION")}
          title={decisionsEnabled ? "Write an audit-only correction decision" : "Locked by AUTOMATION_ALLOW_REVIEW_DECISIONS"}
          className="rounded-lg border px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          Needs Correction
        </button>
        <button
          disabled={busy || !decisionsEnabled}
          onClick={() => onDecision("REJECTED")}
          title={decisionsEnabled ? "Write an audit-only rejection decision" : "Locked by AUTOMATION_ALLOW_REVIEW_DECISIONS"}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reject Snapshot
        </button>
      </div>
    </article>
  );
}

function OfficialLink({ label, url }: { label: string; url?: string | null }) {
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer">{label}</a>
    : <span className="font-normal text-gray-500">{label}: Not specified</span>;
}

function Lock({ label, value, safe }: { label: string; value: string; safe: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${safe ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs uppercase tracking-wide text-gray-500">{label}</div><div className="mt-1 font-bold">{value}</div></div>;
}
