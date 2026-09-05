import type { Metadata } from "next";
import Link from "next/link";
import { getJobs } from "../../actions/jobs";
import JobCard from "../components/JobCard";
import PublicFooter from "@/components/PublicFooter";

export const metadata: Metadata = { title: "Private Jobs", description: "Active private-company job listings in India with official career-page and application links." };
export const dynamic = "force-dynamic";

export default async function PrivateJobsPage() {
  const jobs = (await getJobs()).filter((job) => job.category.toLowerCase().includes("private"));
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6"><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-widest">Company careers</span><h1 className="mt-5 text-4xl font-black sm:text-5xl">Latest Private Jobs</h1><p className="mt-4 max-w-3xl text-slate-300">Browse active private-company opportunities gathered from public career sources. Check the employer page before applying.</p><div className="mt-7 flex gap-3"><Link href="/" className="rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-slate-950">← Home</Link><Link href="/government-jobs" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-extrabold">Government Jobs →</Link></div></div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><h2 className="text-3xl font-black">Private Job Listings</h2><p className="mt-2 text-sm text-slate-500">Showing {jobs.length} active listing{jobs.length === 1 ? "" : "s"}.</p>{jobs.length ? <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div> : <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><h3 className="text-xl font-black">No active private jobs found</h3><p className="mt-2 text-sm text-slate-500">Verified active listings will appear here.</p></div>}</section>
      <PublicFooter />
    </main>
  );
}
