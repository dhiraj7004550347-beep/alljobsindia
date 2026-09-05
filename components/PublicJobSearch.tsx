import Link from "next/link";
import { PUBLIC_JOBS_PAGE_SIZE, type PublicJobFilters } from "@/lib/public-jobs-query";

type Job = {
  id: number;
  title: string;
  department?: string | null;
  category?: string | null;
  vacancy?: string | null;
  location?: string | null;
  lastDate?: Date | string | null;
  featured?: boolean;
};

type Props = {
  jobs: Job[];
  filters: PublicJobFilters;
  categories: string[];
  locations: string[];
  total: number;
  page: number;
  pageCount: number;
};

function pageHref(filters: PublicJobFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.category) params.set("category", filters.category);
  if (filters.location) params.set("location", filters.location);
  if (filters.closingSoon) params.set("closing", "soon");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

export default function PublicJobSearch({
  jobs,
  filters,
  categories,
  locations,
  total,
  page,
  pageCount,
}: Props) {
  const firstResult = total === 0 ? 0 : (page - 1) * PUBLIC_JOBS_PAGE_SIZE + 1;
  const lastResult = total === 0 ? 0 : Math.min(total, firstResult + jobs.length - 1);

  return (
    <div className="space-y-6">
      <form method="GET" action="/jobs" className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <label className="block lg:col-span-2">
            <span className="mb-2 block text-sm font-semibold">Search Jobs</span>
            <input
              name="q"
              defaultValue={filters.query}
              maxLength={120}
              placeholder="Search SSC, Railway, NTPC, Engineer..."
              className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Category</span>
            <select name="category" defaultValue={filters.category} className="w-full rounded-xl border px-4 py-3">
              <option value="">All Categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Location</span>
            <select name="location" defaultValue={filters.location} className="w-full rounded-xl border px-4 py-3">
              <option value="">All Locations</option>
              {locations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Deadline</span>
            <select name="closing" defaultValue={filters.closingSoon ? "soon" : ""} className="w-full rounded-xl border px-4 py-3">
              <option value="">All Active Jobs</option>
              <option value="soon">Closing in 7 Days</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">Apply Filters</button>
          <Link href="/jobs" className="rounded-xl border px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Reset Filters</Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing <strong>{firstResult}{total > 0 ? `–${lastResult}` : ""}</strong> of <strong>{total}</strong> active jobs
        </p>
        <p className="text-sm font-semibold text-slate-600">Page {page} of {pageCount}</p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          <div className="text-4xl">🔎</div>
          <h3 className="mt-3 text-lg font-bold">No jobs found</h3>
          <p className="mt-2 text-sm text-gray-500">Try changing your search or filters.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {job.featured && <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold text-yellow-700">⭐ Featured</span>}
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{job.category || "Jobs"}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-bold">{job.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{job.department || "Not specified"}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
                    <span>📍 {job.location || "Not specified"}</span>
                    <span>👥 {job.vacancy || "Not specified"}</span>
                    {job.lastDate && <span>📅 {new Date(job.lastDate).toLocaleDateString("en-IN")}</span>}
                  </div>
                </div>
                <span className="inline-flex shrink-0 justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">View Job →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="Job result pages" className="flex items-center justify-center gap-3">
          {page > 1 ? <Link href={pageHref(filters, page - 1)} className="rounded-xl border bg-white px-5 py-3 font-bold text-slate-700">← Previous</Link> : <span className="rounded-xl border bg-slate-100 px-5 py-3 font-bold text-slate-400">← Previous</span>}
          {page < pageCount ? <Link href={pageHref(filters, page + 1)} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Next →</Link> : <span className="rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-400">Next →</span>}
        </nav>
      )}
    </div>
  );
}
