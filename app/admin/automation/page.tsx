"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PreviewJob = { title: string; department?: string | null; qualification?: string | null; vacancy?: string | null; salary?: string | null; ageLimit?: string | null; location?: string | null; applicationFee?: string | null; selectionProcess?: string | null; applicationStartDate?: string | null; lastDate?: string | null; applyLink?: string | null; notificationLink?: string | null; officialWebsite?: string | null; sourceName: string; sourceUrl: string; confidence: number; action: string; reason: string };
type RunItem = { id: number; action: string; sourceName?: string | null; candidateTitle?: string | null; reason?: string | null; error?: string | null; jobId?: number | null; details?: { kind?: string; preview?: PreviewJob; rawLinks?: number; recruitmentLinks?: number; uniqueNotices?: number; parsedJobs?: number; rejected?: number; lowConfidence?: number } | null };
type Run = {
  id: number; startedAt: string; completedAt?: string | null; status: string; dryRun: boolean; durationMs?: number | null;
  sourcesChecked: number; sourcesSucceeded: number; sourcesFailed: number; candidates: number; processed: number; wouldAdd: number; wouldUpdate?: number; added: number; updated: number; duplicates: number; expired: number; skipped: number; errors: number; draftsCreated: number; errorMessage?: string | null; items?: RunItem[];
  rawLinks?: number; recruitmentLinks?: number; uniqueNotices?: number; parsedJobs?: number; rejected?: number; lowConfidence?: number;
  previewJobs?: PreviewJob[];
};
type Status = { dryRun: boolean; autoPublish: boolean; writeRunsEnabled: boolean; manualDraftsEnabled: boolean; reviewDecisionsEnabled: boolean; sourceCount: number; enabledSourceCount: number; pendingSourceCount: number; aiEnabled: boolean; maxSources: number; maxJobsPerRun: number; lastRun?: Run | null };

export default function AutomationDashboard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Run | null>(null);
  const [logs, setLogs] = useState<Run[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const [statusResponse, logsResponse] = await Promise.all([
      fetch("/api/automation/status", { cache: "no-store" }),
      fetch("/api/automation/logs", { cache: "no-store" }),
    ]);
    if (statusResponse.ok) setStatus(await statusResponse.json());
    if (logsResponse.ok) setLogs((await logsResponse.json()).logs || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch(() => setMessage("Unable to load automation status."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function run(dryRun: boolean) {
    if (!dryRun && !status?.writeRunsEnabled) {
      setMessage("Write runs are locked by the server environment.");
      return;
    }
    if (!dryRun && !window.confirm("Run collection with database writes? Unverified or low-confidence candidates will remain DRAFT.")) return;
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/automation/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Automation failed");
      setResult(body.result);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Automation failed");
    } finally { setLoading(false); }
  }

  const display = result || status?.lastRun || null;
  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold">Automation Control Center</h1><p className="mt-2 text-gray-600">Run bounded source collection and inspect persistent database logs.</p></div><div className="flex flex-wrap gap-3"><Link href="/admin/review" className="rounded-lg border bg-white px-5 py-3 font-bold">Manual Review</Link><Link href="/admin/sources" className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white">Manage Sources</Link></div></div>

      <section className="rounded-xl border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-5">
          <Mini title="Sources" value={`${status?.enabledSourceCount ?? 0}/${status?.sourceCount ?? 0} enabled`} />
          <Mini title="Pending review" value={status?.pendingSourceCount ?? 0} />
          <Mini title="Default mode" value={status?.dryRun ? "Dry run" : "Write run"} />
          <Mini title="AI extraction" value={status?.aiEnabled ? "Configured" : "Optional / off"} />
          <Mini title="Auto publish" value={status?.autoPublish ? "Globally eligible" : "Disabled"} />
        </div>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Auto-publishing requires all three gates: global opt-in, a trusted source with auto-publish enabled, and high confidence. The safe default is off.</p>
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Bulk database writes: <strong>{status?.writeRunsEnabled ? "ENABLED" : "LOCKED"}</strong> · Manual drafts: <strong>{status?.manualDraftsEnabled ? "ENABLED" : "LOCKED"}</strong></p>
        <div className="mt-5 flex flex-wrap gap-3"><button disabled={loading} onClick={() => run(true)} className="rounded-lg border px-5 py-3 font-semibold disabled:opacity-50">{loading ? "Running…" : "Preview / Dry Run"}</button><button disabled={loading || !status?.writeRunsEnabled} onClick={() => run(false)} title={status?.writeRunsEnabled ? "Run with database writes" : "Requires AUTOMATION_DRY_RUN=false and AUTOMATION_ALLOW_WRITE_RUNS=true"} className="rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{status?.writeRunsEnabled ? "Run Collection" : "Write Runs Locked"}</button></div>
        {message && <p className="mt-4 text-red-700">{message}</p>}
      </section>

      {display && <RunSummary run={display} />}

      {result?.previewJobs && result.previewJobs.length > 0 && <PreviewList title="Current dry-run notice preview" jobs={result.previewJobs} />}

      <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Recent persistent runs</h2>{logs.length === 0 ? <p className="mt-3 text-gray-500">No runs have been logged.</p> : <div className="mt-4 space-y-4">{logs.map((run) => <details key={run.id} className="rounded-lg border p-4"><summary className="cursor-pointer font-semibold">#{run.id} · {new Date(run.startedAt).toLocaleString("en-IN")} · {run.status} · {run.dryRun ? "Dry run" : "Write run"}</summary><div className="mt-4"><RunSummary run={run} compact />{run.errorMessage && <p className="mt-3 text-red-700">{run.errorMessage}</p>}<PreviewList title="Notice records" jobs={(run.items || []).flatMap((item) => item.details?.kind === "candidate" && item.details.preview ? [item.details.preview] : [])} /><RunItemTable items={(run.items || []).filter((item) => item.details?.kind !== "candidate" && item.details?.kind !== "metrics")} /></div></details>)}</div>}</section>
    </main>
  );
}

function RunSummary({ run, compact = false }: { run: Run; compact?: boolean }) {
  const persisted = run.items?.find((item) => item.details?.kind === "metrics")?.details;
  const metric = (key: "rawLinks" | "recruitmentLinks" | "uniqueNotices" | "parsedJobs" | "rejected" | "lowConfidence") => run[key] ?? persisted?.[key] ?? (key === "rawLinks" ? run.candidates : key === "parsedJobs" ? run.processed : 0);
  const cards = [
    ["Status", run.status], ["Duration", run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"],
    ["Sources", `${run.sourcesSucceeded}/${run.sourcesChecked} succeeded`], ["Failed sources", run.sourcesFailed],
    ["Raw links", metric("rawLinks")], ["Recruitment links", metric("recruitmentLinks")], ["Unique notices", metric("uniqueNotices")], ["Parsed jobs", metric("parsedJobs")],
    ["Would add", run.wouldAdd], ["Actually added", run.added], [run.dryRun ? "Would update" : "Updated", run.wouldUpdate ?? run.updated], ["True duplicates", run.duplicates], ["Rejected / noise", metric("rejected")], ["Low confidence", metric("lowConfidence")], ["Expired", run.expired], ["Errors", run.errors],
  ];
  return <section className={compact ? "" : "rounded-xl border bg-white p-5"}>{!compact && <h2 className="mb-4 text-xl font-bold">{run.dryRun ? "Dry-run result" : "Write-run result"} #{run.id}</h2>}<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">{cards.map(([title, value]) => <Mini key={String(title)} title={String(title)} value={value as string | number} />)}</div></section>;
}

function PreviewList({ title, jobs }: { title: string; jobs: PreviewJob[] }) {
  if (!jobs.length) return null;
  const fields: Array<[string, keyof PreviewJob]> = [["Department / company", "department"], ["Qualification", "qualification"], ["Vacancies", "vacancy"], ["Salary / pay scale", "salary"], ["Age limit", "ageLimit"], ["Location", "location"], ["Application fee", "applicationFee"], ["Selection process", "selectionProcess"], ["Application start", "applicationStartDate"], ["Last date", "lastDate"]];
  return <section className="mt-4 rounded-lg border p-4"><h3 className="font-bold">{title}</h3><div className="mt-3 space-y-4">{jobs.map((job, index) => <article className="rounded border p-4 text-sm" key={`${job.title}-${index}`}><div className="flex flex-wrap justify-between gap-2"><div><strong>{job.title}</strong><p className="text-gray-600">{job.sourceName} · {Math.round(job.confidence * 100)}%</p></div><span className="font-bold">{job.action}</span></div><p className="mt-2 text-gray-700">{job.reason}</p><dl className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-2">{fields.map(([label, key]) => <div key={label}><dt className="text-xs text-gray-500">{label}</dt><dd>{String(job[key] || "Not specified")}</dd></div>)}</dl><div className="mt-3 flex flex-wrap gap-3 text-blue-700">{[["Apply link", job.applyLink], ["Notification", job.notificationLink], ["Official website", job.officialWebsite], ["Source page", job.sourceUrl]].map(([label, url]) => url ? <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label}</a> : <span className="text-gray-500" key={label}>{label}: Not specified</span>)}</div></article>)}</div></section>;
}

function RunItemTable({ items }: { items: RunItem[] }) {
  if (!items.length) return null;
  return <div className="mt-4 max-h-80 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Action</th><th>Source / candidate</th><th>Reason or error</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b align-top"><td className="py-2 pr-3 font-semibold">{item.action}</td><td className="py-2 pr-3">{item.sourceName || "—"}<small className="block text-gray-500">{item.candidateTitle || ""}</small></td><td className="py-2 text-gray-600">{item.error || item.reason || "—"}</td></tr>)}</tbody></table></div>;
}

function Mini({ title, value }: { title: string; value: string | number }) {
  return <div className="rounded-lg bg-gray-50 p-3"><div className="text-[11px] uppercase tracking-wide text-gray-500">{title}</div><div className="mt-1 font-bold">{value}</div></div>;
}
