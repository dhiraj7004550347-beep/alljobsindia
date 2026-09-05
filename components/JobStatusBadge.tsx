import {
  getJobStatus,
  getJobStatusClass,
  getJobStatusLabel,
  getDaysLeft,
} from "../lib/jobStatus";

interface JobStatusBadgeProps {
  lastDate?: Date | string | null;
  status?: "DRAFT" | "PUBLISHED" | "EXPIRED" | "ARCHIVED";
  featured?: boolean;
}

export default function JobStatusBadge({
  lastDate,
  status = "PUBLISHED",
  featured = false,
}: JobStatusBadgeProps) {
  const labels = { DRAFT: "Draft", EXPIRED: "Expired", ARCHIVED: "Archived" } as const;
  if (status !== "PUBLISHED") {
    return (
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700">
          {labels[status]}
        </span>
        {featured && <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">⭐ Featured</span>}
      </div>
    );
  }

  if (!lastDate) {
    return <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">Published</span>;
  }

  const dateStatus = getJobStatus(lastDate);
  const daysLeft = getDaysLeft(lastDate);
  return (
    <div className="flex flex-wrap gap-2">
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getJobStatusClass(lastDate)}`}>
        {getJobStatusLabel(lastDate)}
      </span>
      {dateStatus !== "EXPIRED" && (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
          {daysLeft === 0 ? "Last Day" : `${daysLeft} days left`}
        </span>
      )}
      {featured && <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">⭐ Featured</span>}
    </div>
  );
}
