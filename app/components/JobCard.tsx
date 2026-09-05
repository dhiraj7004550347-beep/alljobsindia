import Link from "next/link";

type JobCardJob = {
  id: number;
  title: string;
  category?: string | null;
  department?: string | null;
  vacancy?: string | number | null;
  qualification?: string | null;
  location?: string | null;
  lastDate?: string | Date | null;
};

function daysLeft(date?: string | Date | null) {
  if (!date) return null;
  const deadline = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(23, 59, 59, 999);
  return Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
}

export default function JobCard({ job }: { job: JobCardJob }) {
  const days = daysLeft(job.lastDate);
  const urgent = days !== null && days >= 0 && days <= 7;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
      <div className="h-1 bg-gradient-to-r from-blue-700 via-indigo-500 to-cyan-400" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-blue-700">{job.category || "Job"}</span>
          <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${urgent ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{urgent ? "Closing Soon" : "Active"}</span>
        </div>
        <h2 className="mt-4 line-clamp-2 text-lg font-black leading-7 text-slate-950 group-hover:text-blue-700">{job.title}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{job.department || "Not specified"}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Info label="Vacancies" value={job.vacancy} />
          <Info label="Location" value={job.location} />
        </div>
        <div className="mt-3 rounded-xl border border-slate-100 p-3">
          <p className="text-[10px] font-extrabold uppercase text-slate-400">Qualification</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-700">{job.qualification || "Not specified"}</p>
        </div>
        <div className="mt-auto pt-5">
          <div className="mb-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase text-slate-400">Last Date</p>
              <p className={`mt-1 text-sm font-extrabold ${urgent ? "text-rose-600" : "text-slate-800"}`}>
                {job.lastDate ? new Date(job.lastDate).toLocaleDateString("en-IN") : "Not specified"}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">{days === null ? "Open" : urgent ? `${days} day${days === 1 ? "" : "s"} left` : "Open"}</span>
          </div>
          <Link href={`/jobs/${job.id}`} className="flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-700">View Job Details <span className="ml-2">→</span></Link>
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase text-slate-400">{label}</p><p className="mt-1 line-clamp-1 text-sm font-bold text-slate-800">{value || "Not specified"}</p></div>;
}
