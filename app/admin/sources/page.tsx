"use client";

import { useCallback, useEffect, useState } from "react";

type Source = {
  id: number;
  name: string;
  domain: string;
  startUrl: string;
  type: string;
  category: string;
  enabled: boolean;
  trusted: boolean;
  autoPublish: boolean;
  parserType: string;
  reviewStatus: string;
  lastCheckedAt?: string | null;
  lastSuccessAt?: string | null;
  consecutiveFailures: number;
};

const emptySource = {
  name: "",
  startUrl: "",
  type: "GOVERNMENT",
  category: "Government Jobs",
  enabled: false,
  trusted: false,
  autoPublish: false,
  parserType: "GOVERNMENT_HTML",
  reviewStatus: "PENDING",
};

export default function SourceManagerPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm] = useState(emptySource);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [writeRunsEnabled, setWriteRunsEnabled] = useState(false);

  const load = useCallback(async () => {
    const [response, statusResponse] = await Promise.all([
      fetch("/api/admin/sources", { cache: "no-store" }),
      fetch("/api/automation/status", { cache: "no-store" }),
    ]);
    const data = await response.json();
    const statusData = await statusResponse.json();
    if (!response.ok) throw new Error(data.error || "Unable to load sources");
    if (!statusResponse.ok) throw new Error(statusData.error || "Unable to load automation safety status");
    setSources(data.sources || []);
    setWriteRunsEnabled(statusData.writeRunsEnabled === true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) => setMessage(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function update(key: keyof typeof emptySource, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(source: Source) {
    setEditingId(source.id);
    setForm({
      name: source.name,
      startUrl: source.startUrl,
      type: source.type,
      category: source.category,
      enabled: source.enabled,
      trusted: source.trusted,
      autoPublish: source.autoPublish,
      parserType: source.parserType,
      reviewStatus: source.reviewStatus,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        editingId ? `/api/admin/sources/${editingId}` : "/api/admin/sources",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save source");
      setForm(emptySource);
      setEditingId(null);
      setMessage("Source saved. New sources remain untrusted until you approve them.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save source");
    } finally {
      setBusy(false);
    }
  }

  async function run(source: Source, dryRun: boolean) {
    if (!dryRun && !writeRunsEnabled) {
      setMessage("Write runs are locked. Source Test remains read-only and available.");
      return;
    }
    if (!dryRun && !window.confirm("Collect from this source now? New jobs will remain drafts unless global auto-publish is explicitly enabled.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/sources/${source.id}/${dryRun ? "test" : "run"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Source run failed");
      const result = data.result;
      setMessage(dryRun
        ? `Read-only test: ${result.access}. Raw links ${result.rawLinks ?? result.candidates}; recruitment links ${result.recruitmentLinks ?? 0}; unique notices ${result.uniqueNotices ?? 0}; parsed jobs ${result.parsedJobs ?? result.processed}; would add ${result.wouldAdd}; would update ${result.updated}; rejected ${result.rejected ?? 0}; errors ${result.errors}. No Job or source record was written.`
        : `Run finished: raw links ${result.rawLinks ?? result.candidates}; unique notices ${result.uniqueNotices ?? result.processed}; would add ${result.wouldAdd || result.added}.`
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Source run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Source Manager</h1>
        <p className="mt-2 text-gray-600">
          Maintain a reviewed registry of official recruitment sources. Discovery never trusts or enables a source automatically.
        </p>
      </div>

      <form onSubmit={save} className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">{editingId ? "Edit Source" : "Add Official Source"}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Source name"><input required value={form.name} onChange={(event) => update("name", event.target.value)} className="input" /></Field>
          <Field label="Start URL"><input required type="url" value={form.startUrl} onChange={(event) => update("startUrl", event.target.value)} className="input" /></Field>
          <Field label="Source type"><select value={form.type} onChange={(event) => update("type", event.target.value)} className="input">{["GOVERNMENT","PSU","BANKING","RAILWAY","UNIVERSITY","HOSPITAL","PRIVATE_COMPANY","OTHER_OFFICIAL"].map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Public category"><input required value={form.category} onChange={(event) => update("category", event.target.value)} className="input" /></Field>
          <Field label="Parser"><select value={form.parserType} onChange={(event) => update("parserType", event.target.value)} className="input"><option>GENERIC_HTML</option><option>GOVERNMENT_HTML</option><option>PDF_NOTIFICATION</option></select></Field>
          <Field label="Review status"><select value={form.reviewStatus} onChange={(event) => update("reviewStatus", event.target.value)} className="input"><option>PENDING</option><option>APPROVED</option><option>REJECTED</option></select></Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-5">
          <Check label="Enabled" checked={form.enabled} onChange={(value) => update("enabled", value)} />
          <Check label="Trusted" checked={form.trusted} onChange={(value) => update("trusted", value)} />
          <Check label="Eligible for auto-publish" checked={form.autoPublish} onChange={(value) => update("autoPublish", value)} />
        </div>
        <p className="mt-3 text-sm text-amber-700">Auto-publish also requires approved + trusted source, high confidence, and the global environment switch. The global switch remains off by default. Bulk write runs are currently {writeRunsEnabled ? "enabled" : "locked"}.</p>
        <div className="mt-5 flex gap-3">
          <button disabled={busy} className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Working..." : "Save Source"}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptySource); }} className="rounded-lg border px-5 py-3 font-semibold">Cancel</button>}
        </div>
      </form>

      {message && <div className="rounded-xl border bg-white p-4 text-sm font-semibold">{message}</div>}

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-slate-50 text-left"><tr>{["Source","Type","Trust","Health","Last checked","Last success","Actions"].map((label) => <th key={label} className="p-4">{label}</th>)}</tr></thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t align-top">
                <td className="p-4"><p className="font-bold">{source.name}</p><a href={source.startUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-700">{source.domain}</a></td>
                <td className="p-4"><p>{source.type}</p><p className="text-xs text-gray-500">{source.parserType}</p></td>
                <td className="p-4"><p>{source.reviewStatus}</p><p className="text-xs">{source.enabled ? "Enabled" : "Disabled"} · {source.trusted ? "Trusted" : "Untrusted"} · Auto {source.autoPublish ? "eligible" : "off"}</p></td>
                <td className="p-4">{source.consecutiveFailures === 0 ? "Healthy" : `${source.consecutiveFailures} failure(s)`}</td>
                <td className="p-4">{source.lastCheckedAt ? new Date(source.lastCheckedAt).toLocaleString("en-IN") : "Never"}</td>
                <td className="p-4">{source.lastSuccessAt ? new Date(source.lastSuccessAt).toLocaleString("en-IN") : "Never"}</td>
                <td className="p-4"><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => edit(source)} className="rounded border px-3 py-2">Edit</button><button disabled={busy} onClick={() => void run(source, true)} className="rounded border px-3 py-2">Test</button><button disabled={busy || !source.enabled || !writeRunsEnabled} title={writeRunsEnabled ? "Run source with database writes" : "Bulk write runs are locked"} onClick={() => void run(source, false)} className="rounded bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40">{writeRunsEnabled ? "Run" : "Locked"}</button></div></td>
              </tr>
            ))}
            {sources.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-gray-500">No sources yet. Add only an official source you have reviewed.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block font-semibold">{label}</span>{children}</label>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> <span className="font-semibold">{label}</span></label>;
}
