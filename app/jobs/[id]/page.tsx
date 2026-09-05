import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createJobMetadata } from "@/lib/seo";
import { createJobStructuredData } from "@/lib/job-seo";
import PublicFooter from "@/components/PublicFooter";
import AdSlot from "@/components/AdSlot";

type PageProps = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

const getPublishedJob = cache(async (id: number) => {
  const now = new Date();
  return prisma.job.findFirst({
    where: {
      id,
      status: "PUBLISHED",
      OR: [
        { lastDate: null, expiresAt: null },
        { lastDate: { gte: now } },
        { expiresAt: { gte: now } },
      ],
    },
  });
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const jobId = Number((await params).id);
  if (!Number.isInteger(jobId) || jobId <= 0) return missingMetadata();
  const job = await getPublishedJob(jobId);
  if (!job) return missingMetadata();
  return createJobMetadata(job);
}

function missingMetadata(): Metadata {
  return { title: "Job Not Found", robots: { index: false, follow: false } };
}

export default async function JobDetails({ params }: PageProps) {
  const jobId = Number((await params).id);
  if (!Number.isInteger(jobId) || jobId <= 0) notFound();
  const job = await getPublishedJob(jobId);
  if (!job) notFound();

  // Google requires a complete, visible description, employer, posting date,
  // location and a way to apply. Omit markup instead of fabricating any field.
  const datePosted = job.postedDate || job.publishedAt;
  const hasApplicationPath = Boolean(job.applyLink || job.notificationLink || job.officialWebsite);
  const structuredData =
    job.description && job.department && job.location && datePosted && hasApplicationPath
      ? createJobStructuredData({
          title: job.title,
          description: job.description,
          organization: job.department,
          officialWebsite: job.officialWebsite,
          location: job.location,
          lastDate: job.lastDate,
          datePosted,
          sourceJobId: job.sourceJobId,
          jobPagePath: `/jobs/${job.id}`,
        })
      : null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      )}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Link href="/" className="text-xl font-black text-blue-800">All Jobs India</Link>
          <nav className="flex gap-4 text-sm font-semibold"><Link href="/jobs">All Jobs</Link><Link href="/government-jobs">Government</Link><Link href="/private-jobs">Private</Link></nav>
        </div>
      </header>

      <section className="border-b bg-gradient-to-br from-blue-950 to-indigo-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex gap-2 text-sm text-blue-100"><Link href="/">Home</Link><span>/</span><Link href="/jobs">Jobs</Link></div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase">{job.category}</span>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight md:text-5xl">{job.title}</h1>
          {job.department && <p className="mt-4 text-lg text-blue-100">{job.department}{job.location ? ` · ${job.location}` : ""}</p>}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-7 px-4 py-9 lg:grid-cols-[1fr_320px]">
        <div className="space-y-7">
          {job.description && <Section title="Job Overview"><p className="whitespace-pre-line leading-7 text-slate-700">{job.description}</p></Section>}
          <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_JOB_SLOT || ""} />
          <Section title="Job Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Department / Company" value={job.department} />
              <Info label="Qualification" value={job.qualification} />
              <Info label="Vacancies" value={job.vacancy} />
              <Info label="Age Limit" value={job.ageLimit} />
              <Info label="Salary / Pay Scale" value={job.salary} />
              <Info label="Location" value={job.location} />
              <Info label="Application Fee" value={job.applicationFee} />
              <Info label="Selection Process" value={job.selectionProcess} />
            </div>
          </Section>

          <Section title="Important Dates">
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Application Start Date" value={formatDate(job.applicationStartDate)} />
              <Info label="Last Date" value={formatDate(job.lastDate)} />
              {importantDates(job.importantDates).map((item) => <Info key={`${item.label}-${item.value}`} label={item.label} value={item.value} />)}
            </div>
          </Section>

          {job.howToApply && <Section title="How to Apply"><p className="whitespace-pre-line leading-7 text-slate-700">{job.howToApply}</p></Section>}

          <Section title="Official Links">
            <div className="flex flex-wrap gap-3">
              {job.applyLink && <OfficialLink href={job.applyLink} label="Apply on Official Website" primary />}
              {job.notificationLink && <OfficialLink href={job.notificationLink} label="Official Notification" />}
              {job.officialWebsite && <OfficialLink href={job.officialWebsite} label="Official Website" />}
              {!hasApplicationPath && <p className="text-slate-600">No official link is currently specified. Verify this listing before acting.</p>}
            </div>
          </Section>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Application deadline</p>
            <p className="mt-2 text-xl font-black text-rose-700">{formatDate(job.lastDate) || "Not specified"}</p>
            {job.applyLink && <a href={job.applyLink} target="_blank" rel="noopener noreferrer" className="mt-5 flex justify-center rounded-xl bg-green-600 px-4 py-3 font-bold text-white">Apply on official site</a>}
          </div>
          <div className="rounded-2xl border bg-white p-6 text-sm leading-6 text-slate-600 shadow-sm">
            <h2 className="font-black text-slate-900">Source & verification</h2>
            <p className="mt-2">Source: {job.sourceName || "Manually verified listing"}</p>
            {job.sourceUrl && <a className="mt-2 block break-all font-semibold text-blue-700" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">View source</a>}
            <p className="mt-3">Last updated: {formatDate(job.updatedAt)}</p>
            <p className="mt-3">Always verify eligibility, fees and dates in the official notification before applying.</p>
          </div>
        </aside>
      </div>
      <PublicFooter />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="mb-5 text-2xl font-black">{title}</h2>{children}</section>;
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value || "Not specified"}</p></div>;
}

function OfficialLink({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={`rounded-xl px-5 py-3 font-bold ${primary ? "bg-green-600 text-white" : "border border-blue-200 bg-blue-50 text-blue-800"}`}>{label}</a>;
}

function formatDate(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function importantDates(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const label = String((item as Record<string, unknown>).label || "").trim();
    const dateValue = String((item as Record<string, unknown>).value || "").trim();
    return label && dateValue ? [{ label, value: dateValue }] : [];
  }).slice(0, 20);
}
