"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type JobFormData = {
  id?: number;
  title: string;
  department: string;
  qualification: string;
  vacancy: string;
  salary: string;
  ageLimit: string;
  location: string;
  applicationFee: string;
  selectionProcess: string;
  description: string;
  howToApply: string;
  applicationStartDate: string;
  lastDate: string;
  applyLink: string;
  notificationLink: string;
  officialWebsite: string;
  category: string;
  status: "DRAFT" | "PUBLISHED" | "EXPIRED" | "ARCHIVED";
  featured: boolean;
};

const emptyJob: JobFormData = {
  title: "",
  department: "",
  qualification: "",
  vacancy: "",
  salary: "",
  ageLimit: "",
  location: "",
  applicationFee: "",
  selectionProcess: "",
  description: "",
  howToApply: "",
  applicationStartDate: "",
  lastDate: "",
  applyLink: "",
  notificationLink: "",
  officialWebsite: "",
  category: "Government Jobs",
  status: "DRAFT",
  featured: false,
};

const fields: Array<{
  key: keyof JobFormData;
  label: string;
  placeholder?: string;
  type?: string;
}> = [
  { key: "department", label: "Department / Company", placeholder: "Staff Selection Commission" },
  { key: "qualification", label: "Qualification", placeholder: "Graduation" },
  { key: "vacancy", label: "Vacancies", placeholder: "5000" },
  { key: "salary", label: "Salary / Pay Scale", placeholder: "₹25,500 - ₹81,100" },
  { key: "ageLimit", label: "Age Limit", placeholder: "18-32 years" },
  { key: "location", label: "Location", placeholder: "Delhi" },
  { key: "applicationFee", label: "Application Fee", placeholder: "₹100" },
  { key: "selectionProcess", label: "Selection Process", placeholder: "Exam and interview" },
  { key: "applicationStartDate", label: "Application Start Date", type: "date" },
  { key: "lastDate", label: "Last Date", type: "date" },
];

const links: Array<{ key: keyof JobFormData; label: string }> = [
  { key: "applyLink", label: "Official Apply Link" },
  { key: "notificationLink", label: "Official Notification / PDF" },
  { key: "officialWebsite", label: "Official Website" },
];

export default function JobForm({ initialData }: { initialData?: JobFormData }) {
  const router = useRouter();
  const [form, setForm] = useState<JobFormData>(initialData || emptyJob);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function updateField(field: keyof JobFormData, value: string | boolean) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        initialData?.id ? `/api/jobs/${initialData.id}` : "/api/jobs",
        {
          method: initialData?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save job.");
      router.push("/admin/jobs");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save job.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-5 text-xl font-bold">Basic information</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-2 block font-semibold">Job title *</span>
            <input required maxLength={300} value={form.title} onChange={(event) => updateField("title", event.target.value)} className="input" placeholder="SSC CGL 2026" />
          </label>
          <label>
            <span className="mb-2 block font-semibold">Category *</span>
            <select value={form.category} onChange={(event) => updateField("category", event.target.value)} className="input">
              <option value="Government Jobs">Government Jobs</option>
              <option value="Private Jobs">Private Jobs</option>
              <option value="Banking Jobs">Banking Jobs</option>
              <option value="Railway Jobs">Railway Jobs</option>
              <option value="University Jobs">University Jobs</option>
              <option value="Hospital Jobs">Hospital Jobs</option>
              <option value="PSU Jobs">PSU Jobs</option>
            </select>
          </label>
          {fields.map((field) => (
            <label key={field.key}>
              <span className="mb-2 block font-semibold">{field.label}</span>
              <input type={field.type || "text"} value={String(form[field.key] || "")} onChange={(event) => updateField(field.key, event.target.value)} className="input" placeholder={field.placeholder} />
            </label>
          ))}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label>
            <span className="mb-2 block font-semibold">Job overview / description</span>
            <textarea rows={6} maxLength={10_000} value={form.description} onChange={(event) => updateField("description", event.target.value)} className="input" placeholder="Concise, source-supported overview" />
          </label>
          <label>
            <span className="mb-2 block font-semibold">How to apply</span>
            <textarea rows={6} maxLength={5_000} value={form.howToApply} onChange={(event) => updateField("howToApply", event.target.value)} className="input" placeholder="Official application instructions" />
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-5 text-xl font-bold">Official links</h2>
        <div className="space-y-5">
          {links.map((field) => (
            <label key={field.key}>
              <span className="mb-2 block font-semibold">{field.label}</span>
              <input type="url" value={String(form[field.key] || "")} onChange={(event) => updateField(field.key, event.target.value)} className="input" placeholder="https://…" />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-5 text-xl font-bold">Publishing</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <label>
            <span className="mb-2 block font-semibold">Status</span>
            <select value={form.status} onChange={(event) => updateField("status", event.target.value)} className="input">
              <option value="DRAFT">Draft — review required</option>
              <option value="PUBLISHED">Published</option>
              <option value="EXPIRED">Expired</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
            <input type="checkbox" checked={form.featured} onChange={(event) => updateField("featured", event.target.checked)} className="h-5 w-5" />
            <span><strong>Featured job</strong><small className="block text-slate-500">Highlight on public pages while the job is active.</small></span>
          </label>
        </div>
      </section>

      {message && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{message}</div>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={loading} className="rounded-lg bg-blue-700 px-7 py-3 font-bold text-white hover:bg-blue-800 disabled:bg-gray-400">{loading ? "Saving…" : initialData?.id ? "Update Job" : "Create Job"}</button>
        <button type="button" onClick={() => router.push("/admin/jobs")} className="rounded-lg bg-gray-600 px-7 py-3 font-bold text-white">Cancel</button>
      </div>
    </form>
  );
}
