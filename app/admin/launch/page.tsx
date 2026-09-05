"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Check = {
  key: string;
  label: string;
  passed: boolean;
  severity: "BLOCKER" | "WARNING";
  detail: string;
};

type Readiness = {
  ready: boolean;
  generatedAt: string;
  checks: Check[];
  counts: { sources: number; unsafeSources: number; publishedJobs: number; draftJobs: number; latestRunId: number | null };
};

export default function LaunchReadinessPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/launch-readiness", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load launch readiness");
      setReadiness(body.readiness);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load launch readiness");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Launch Readiness</h1>
          <p className="mt-2 text-gray-600">Read-only certification for the V9 reliability, V10 review and V11 launch gates.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/review" className="rounded-lg border bg-white px-4 py-2 font-semibold">Manual Review</Link>
          <button disabled={loading} onClick={() => void load()} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{loading ? "Checking…" : "Refresh checks"}</button>
        </div>
      </div>
      {message && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{message}</p>}
      {readiness && (
        <>
          <section className={`rounded-2xl border p-5 ${readiness.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-bold uppercase tracking-wide">Overall certification</p><h2 className="mt-1 text-2xl font-black">{readiness.ready ? "READY FOR CONTROLLED LAUNCH" : "BLOCKED — COMPLETE REQUIRED GATES"}</h2></div>
              <p className="text-sm text-gray-600">Checked {new Date(readiness.generatedAt).toLocaleString("en-IN")}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Sources" value={readiness.counts.sources} />
              <Metric label="Unsafe source states" value={readiness.counts.unsafeSources} />
              <Metric label="Published jobs" value={readiness.counts.publishedJobs} />
              <Metric label="Draft jobs" value={readiness.counts.draftJobs} />
            </div>
          </section>
          <section className="space-y-3">
            {readiness.checks.map((item) => <article key={item.key} className={`rounded-xl border bg-white p-4 ${item.passed ? "border-emerald-200" : item.severity === "BLOCKER" ? "border-red-200" : "border-amber-200"}`}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{item.passed ? "✓" : "!"} {item.label}</h3><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.passed ? "bg-emerald-100 text-emerald-800" : item.severity === "BLOCKER" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{item.passed ? "PASS" : item.severity}</span></div><p className="mt-2 text-sm text-gray-600">{item.detail}</p></article>)}
          </section>
          <p className="rounded-lg border bg-white p-4 text-sm text-gray-600">This page performs read-only checks. It does not test sources, create Jobs, enable sources, apply migrations or change auto-publish settings.</p>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-white/70 p-3"><div className="text-xs uppercase tracking-wide text-gray-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>;
}
