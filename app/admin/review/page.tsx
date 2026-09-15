"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { PreviewJob, SourceTestSummary } from "@/lib/automation/types";
import type { ReviewCorrectionField, ReviewCorrections } from "@/lib/automation/review-corrections";

type Source = { id: number; name: string; enabled: boolean; trusted: boolean };
type SafetyStatus = { dryRun: boolean; autoPublish: boolean; writeRunsEnabled: boolean; manualDraftsEnabled: boolean; reviewDecisionsEnabled: boolean };
type SavedCorrection = { candidateKey: string; snapshotHash: string; corrections: ReviewCorrections };
type Entry = { corrections: ReviewCorrections; preview?: PreviewJob; jobId?: number };
type CorrectionResponse = { preview: PreviewJob; corrections: ReviewCorrections };
const filters = ["ALL", "WOULD_ADD", "WOULD_UPDATE", "DUPLICATE", "LOW_CONFIDENCE", "REJECTED", "EXPIRED", "ADDED"] as const;
const fields: Array<{ key: ReviewCorrectionField; label: string; kind?: "long" | "date" | "url" }> = [
  { key: "department", label: "Department / Company" },
  { key: "qualification", label: "Qualification", kind: "long" },
  { key: "vacancy", label: "Vacancies" },
  { key: "salary", label: "Salary / Pay Scale", kind: "long" },
  { key: "ageLimit", label: "Age Limit", kind: "long" },
  { key: "location", label: "Location" },
  { key: "applicationFee", label: "Application Fee" },
  { key: "selectionProcess", label: "Selection Process", kind: "long" },
  { key: "applicationStartDate", label: "Application Start Date", kind: "date" },
  { key: "lastDate", label: "Last Date", kind: "date" },
  { key: "applyLink", label: "Apply Link", kind: "url" },
  { key: "notificationLink", label: "Notification Link", kind: "url" },
  { key: "officialWebsite", label: "Official Website", kind: "url" },
];
const button = "rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40";
const keyOf = (job: Pick<PreviewJob, "candidateKey" | "snapshotHash">) => `${job.candidateKey}:${job.snapshotHash}`;
const identity = (job: PreviewJob) => ({ sourceId: job.sourceId, candidateKey: job.candidateKey, snapshotHash: job.snapshotHash });
const errorText = (error: unknown) => error instanceof Error ? error.message : "Request failed. Please try again.";

async function jsonRequest<T>(url: string, payload?: object): Promise<T> {
  const response = await fetch(url, payload ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  } : { cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false || !body) {
    throw new Error(body?.error || (response.status === 401 ? "Please sign in again." : `Request failed (${response.status}).`));
  }
  return body as T;
}

export default function ManualReviewPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState<SafetyStatus | null>(null);
  const [result, setResult] = useState<SourceTestSummary | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [filter, setFilter] = useState<(typeof filters)[number]>("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [sourceBody, statusBody] = await Promise.all([
      jsonRequest<{ sources: Source[] }>("/api/admin/sources"),
      jsonRequest<SafetyStatus>("/api/automation/status"),
    ]);
    setSources(sourceBody.sources);
    setSelectedId(current => current ?? sourceBody.sources[0]?.id ?? null);
    setStatus(statusBody);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(e => setMessage(errorText(e))); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function inspect() {
    if (!selectedId) return;
    setBusy(true); setMessage(""); setResult(null); setEntries({}); setFilter("ALL");
    try {
      const body = await jsonRequest<{ result: SourceTestSummary }>(`/api/admin/sources/${selectedId}/test`, {});
      let saved: SavedCorrection[] = [];
      let warning = "";
      try { saved = (await jsonRequest<{ saved: SavedCorrection[] }>(`/api/admin/review/correction?sourceId=${selectedId}`)).saved; }
      catch { warning = " Saved corrections could not be loaded; retry before editing a previously saved notice."; }
      const available = new Set(body.result.previewJobs.map(keyOf));
      const next: Record<string, Entry> = {};
      for (const item of saved) {
        const key = keyOf(item);
        if (available.has(key)) next[key] = { corrections: item.corrections };
      }
      setEntries(next); setResult(body.result);
      setMessage("Inspection complete. No jobs were created." + warning);
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  }

  async function save(job: PreviewJob, corrections: ReviewCorrections) {
    setBusy(true);
    try {
      const body = await jsonRequest<{ result: CorrectionResponse }>("/api/admin/review/correction", { ...identity(job), corrections });
      setEntries(current => ({ ...current, [keyOf(job)]: body.result }));
      setMessage("Corrections saved. Review the accepted values below before creating a draft.");
      return body.result;
    } finally { setBusy(false); }
  }

  async function draft(job: PreviewJob, corrections: ReviewCorrections) {
    setBusy(true);
    try {
      const body = await jsonRequest<{ result: { created: boolean; jobId: number; action: string; reason: string } }>(
        "/api/admin/review/draft", { ...identity(job), corrections, confirmation: "CREATE_DRAFT" }
      );
      const value = body.result;
      const preview: PreviewJob = { ...job, action: value.created ? "ADDED" : value.action === "WOULD_UPDATE" ? "WOULD_UPDATE" : "DUPLICATE", reason: value.reason };
      setEntries(current => ({ ...current, [keyOf(job)]: { corrections, preview, jobId: value.jobId } }));
      setMessage(value.created ? `Draft #${value.jobId} created. Open Manage Job to review it.` : value.reason);
    } finally { setBusy(false); }
  }

  async function decide(job: PreviewJob, decision: "REJECTED" | "NEEDS_CORRECTION", reason: string) {
    setBusy(true);
    try {
      await jsonRequest("/api/admin/review/decision", { ...identity(job), decision, reason });
      setEntries(current => ({ ...current, [keyOf(job)]: {
        corrections: current[keyOf(job)]?.corrections || {},
        preview: { ...job, action: decision === "REJECTED" ? "REJECTED" : "LOW_CONFIDENCE", reason },
      } }));
      setMessage("Review decision saved.");
    } finally { setBusy(false); }
  }

  const jobs = useMemo(() => (result?.previewJobs || []).map(job => entries[keyOf(job)]?.preview || job), [result, entries]);
  const count = (action: string) => jobs.filter(job => job.action === action).length;
  return (
    <main className="min-w-0 space-y-6">
      <div><h1 className="text-3xl font-bold">Manual Review Correction Workspace</h1>
        <p className="mt-2 text-gray-600">Inspect official notices, correct extracted details and create unpublished drafts.</p></div>
      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-bold">Available actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Automation" value={!status ? "Loading" : status.dryRun ? "DRY RUN" : "WRITE MODE"} />
          <Metric label="Bulk writes" value={!status ? "Loading" : status.writeRunsEnabled ? "ENABLED" : "LOCKED"} />
          <Metric label="Corrections" value={!status ? "Loading" : status.reviewDecisionsEnabled ? "ENABLED" : "LOCKED"} />
          <Metric label="Manual drafts" value={!status ? "Loading" : status.manualDraftsEnabled ? "ENABLED" : "LOCKED"} />
          <Metric label="Auto-publish" value={!status ? "Loading" : status.autoPublish ? "ENABLED" : "OFF"} />
        </div>
        <p className="mt-3 text-sm text-gray-600">This page saves corrections and unpublished drafts. Verify details against the official notification.</p>
      </section>
      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 basis-64"><span className="mb-2 block font-semibold">Official source</span>
            <select disabled={busy} className="w-full min-w-0 rounded-lg border px-3 py-3" value={selectedId ?? ""}
              onChange={e => { setSelectedId(Number(e.target.value)); setResult(null); setEntries({}); }}>
              {!sources.length && <option value="">Loading sources...</option>}
              {sources.map(source => <option key={source.id} value={source.id}>{source.name} · {source.enabled ? "Enabled" : "Disabled"} · {source.trusted ? "Trusted" : "Untrusted"}</option>)}
            </select></label>
          <button disabled={busy || !selectedId} onClick={() => void inspect()} className={`${button} bg-blue-700 text-white`}>{busy ? "Working..." : "Load Read-only Review"}</button>
        </div>
        {message && <p role="status" className="mt-4 break-words rounded-lg bg-slate-50 p-3 text-sm">{message}</p>}
      </section>
      {result && <>
        <section className="rounded-2xl border bg-white p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Access" value={result.access} /><Metric label="Raw links" value={result.rawLinks} />
            <Metric label="Recruitment links" value={result.recruitmentLinks} /><Metric label="Unique notices" value={result.uniqueNotices} />
            <Metric label="Would add" value={count("WOULD_ADD")} /><Metric label="Low confidence" value={count("LOW_CONFIDENCE")} />
            <Metric label="Would update" value={count("WOULD_UPDATE")} /><Metric label="Duplicates" value={count("DUPLICATE")} />
            <Metric label="Rejected / noise" value={result.rejected} /><Metric label="Expired" value={count("EXPIRED")} />
            <Metric label="Errors" value={result.errors} /><Metric label="Drafts created here" value={count("ADDED")} />
          </div>
          {!!result.warnings?.length && <details className="mt-4 rounded-lg bg-amber-50 p-3 text-sm"><summary className="cursor-pointer font-bold">Parser warnings ({result.warnings.length})</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">{result.warnings.map((warning, i) => <li className="break-words" key={i}>{warning}</li>)}</ul></details>}
        </section>
        <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">{filters.map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`${button} ${filter === value ? "bg-slate-900 text-white" : "bg-white"}`}>{value} ({value === "ALL" ? jobs.length : count(value)})</button>)}</div>
          {jobs.map(job => <div key={keyOf(job)} hidden={filter !== "ALL" && filter !== job.action}><CandidateCard job={job} entry={entries[keyOf(job)]} busy={busy} draftEnabled={status?.manualDraftsEnabled === true} decisionsEnabled={status?.reviewDecisionsEnabled === true} onSave={save} onDraft={draft} onDecision={decide} /></div>)}
          {!jobs.some(job => filter === "ALL" || job.action === filter) && <p className="py-6 text-center text-gray-500">No notices match this filter.</p>}
        </section>
      </>}
    </main>
  );
}

function formValues(job: PreviewJob, corrections: ReviewCorrections = {}) {
  return Object.fromEntries(fields.map(field => {
    let value = String(Object.hasOwn(corrections, field.key) ? corrections[field.key] ?? "" : job[field.key] ?? "");
    if (field.kind === "date") {
      const indian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
      if (indian) value = `${indian[3]}-${indian[2]}-${indian[1]}`;
    }
    return [field.key, value];
  })) as Record<ReviewCorrectionField, string>;
}

function CandidateCard({ job, entry, busy, draftEnabled, decisionsEnabled, onSave, onDraft, onDecision }: {
  job: PreviewJob; entry?: Entry; busy: boolean; draftEnabled: boolean; decisionsEnabled: boolean;
  onSave: (job: PreviewJob, corrections: ReviewCorrections) => Promise<CorrectionResponse>;
  onDraft: (job: PreviewJob, corrections: ReviewCorrections) => Promise<void>;
  onDecision: (job: PreviewJob, decision: "REJECTED" | "NEEDS_CORRECTION", reason: string) => Promise<void>;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => formValues(job, entry?.corrections));
  const [changes, setChanges] = useState<ReviewCorrections>({});
  const [error, setError] = useState("");
  const needsRecheck = !!entry && !entry.preview && Object.keys(entry.corrections).length > 0;
  function openEditor() {
    setValues(formValues(job, needsRecheck ? entry?.corrections : undefined));
    setChanges({}); setError(""); setEditing(true);
  }
  async function save() {
    setError("");
    try {
      const corrections = { ...entry?.corrections, ...changes };
      if (!Object.keys(corrections).length) { setError("Change at least one field before saving."); return; }
      const result = await onSave(job, corrections);
      setValues(formValues(result.preview)); setChanges({}); setEditing(false);
    } catch (e) { setError(errorText(e)); }
  }
  async function draft() {
    if (!window.confirm(`Create one unpublished draft for "${job.title}"?`)) return;
    setError("");
    try { await onDraft(job, entry?.corrections || {}); } catch (e) { setError(errorText(e)); }
  }
  async function decide(decision: "REJECTED" | "NEEDS_CORRECTION") {
    const reason = window.prompt("Describe the reason for this review decision (10-1000 characters).")?.trim();
    if (!reason) return;
    if (reason.length < 10 || reason.length > 1000) { setError("Enter a specific reason of 10-1000 characters."); return; }
    try { await onDecision(job, decision, reason); } catch (e) { setError(errorText(e)); }
  }
  return (
    <article className="min-w-0 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap justify-between gap-3"><div className="min-w-0 flex-1 basis-64">
        <h3 className="break-words text-lg font-bold">{job.title}</h3><p className="mt-1 text-sm text-gray-600">{job.sourceName} · {Math.round(job.confidence * 100)}% confidence</p></div>
        <span className="h-fit rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">{job.action}</span></div>
      <p className="mt-3 break-words rounded-lg bg-gray-50 p-3 text-sm">{job.reason}</p>
      {needsRecheck && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm">Saved corrections are available for this exact notice. Open Edit Fields and save to recheck them.</p>}
      {entry?.jobId && <a className="mt-3 inline-block font-semibold text-blue-700" href={`/admin/jobs/${entry.jobId}`}>Open Job #{entry.jobId}</a>}
      {!editing ? <dl className="mt-4 grid gap-4 md:grid-cols-2">{fields.filter(field => field.kind !== "url").map(field => <div className="min-w-0" key={field.key}><dt className="text-xs font-semibold uppercase text-gray-500">{field.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{job[field.key] || "Not specified"}</dd></div>)}</dl>
        : <form onSubmit={event => { event.preventDefault(); void save(); }} className="mt-4 space-y-4">
          <p className="text-sm text-gray-600">Use facts from the official notification. Review accepted values after saving; parser cleanup still applies.</p>
          <div className="grid gap-4 md:grid-cols-2">{fields.map(field => <label htmlFor={`${id}-${field.key}`} className={`min-w-0 ${field.kind === "long" ? "md:col-span-2" : ""}`} key={field.key}>
            <span className="mb-1 block text-sm font-semibold">{field.label}</span>
            {field.kind === "long" ? <textarea id={`${id}-${field.key}`} disabled={busy} maxLength={2000} rows={3} value={values[field.key]} onChange={e => { setValues(v => ({ ...v, [field.key]: e.target.value })); setChanges(v => ({ ...v, [field.key]: e.target.value })); }} className="w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
              : <input id={`${id}-${field.key}`} disabled={busy} maxLength={2000} type={field.kind === "date" ? "date" : field.kind === "url" ? "url" : "text"} value={values[field.key]} onChange={e => { setValues(v => ({ ...v, [field.key]: e.target.value })); setChanges(v => ({ ...v, [field.key]: e.target.value })); }} className="w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />}
          </label>)}</div>
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || !decisionsEnabled} className={`${button} bg-emerald-700 text-white`}>{decisionsEnabled ? "Save Correction" : "Corrections Locked"}</button>
            <button type="button" disabled={busy} onClick={() => { setEditing(false); setChanges({}); setError(""); }} className={button}>Cancel</button></div>
        </form>}
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-blue-700">
        <OfficialLink label="Apply Link" url={job.applyLink} /><OfficialLink label="Notification Link" url={job.notificationLink} />
        <OfficialLink label="Official Website" url={job.officialWebsite} /><OfficialLink label="Source URL" url={job.sourceUrl} />
      </div>
      {error && <p role="alert" className="mt-3 break-words rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!editing && job.action !== "ADDED" && <button disabled={busy} onClick={openEditor} className={`${button} text-blue-700`}>Edit Fields</button>}
        {job.action === "WOULD_ADD" && <button disabled={busy || !draftEnabled || editing || needsRecheck} onClick={() => void draft()} className={`${button} bg-blue-700 text-white`}>{draftEnabled ? "Approve as Draft" : "Draft Creation Locked"}</button>}
        <button disabled={busy || editing || !decisionsEnabled || job.action === "ADDED"} onClick={() => void decide("NEEDS_CORRECTION")} className={button}>Needs Correction</button>
        <button disabled={busy || editing || !decisionsEnabled || job.action === "ADDED"} onClick={() => void decide("REJECTED")} className={`${button} text-red-700`}>Reject Snapshot</button>
      </div>
    </article>
  );
}

function OfficialLink({ label, url }: { label: string; url?: string | null }) {
  const safe = !!url && /^https?:\/\//i.test(url);
  return safe ? <a href={url!} target="_blank" rel="noopener noreferrer">{label}</a> : <span className="font-normal text-gray-500">{label}: Not specified</span>;
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0 rounded-lg bg-gray-50 p-3"><div className="text-xs uppercase text-gray-500">{label}</div><div className="mt-1 break-words font-bold">{value}</div></div>;
}
