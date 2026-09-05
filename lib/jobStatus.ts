export type JobDateStatus = "ACTIVE" | "CLOSING_SOON" | "EXPIRED";

export function getJobStatus(lastDate: Date | string): JobDateStatus {
  const today = new Date();
  const deadline = new Date(lastDate);

  today.setHours(0, 0, 0, 0);
  deadline.setHours(23, 59, 59, 999);

  if (deadline < today) return "EXPIRED";

  const daysLeft = Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft <= 7) return "CLOSING_SOON";
  return "ACTIVE";
}

export function getDaysLeft(lastDate: Date | string): number {
  const today = new Date();
  const deadline = new Date(lastDate);

  today.setHours(0, 0, 0, 0);
  deadline.setHours(23, 59, 59, 999);

  return Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function getJobStatusLabel(lastDate: Date | string): string {
  const status = getJobStatus(lastDate);
  if (status === "EXPIRED") return "Expired";
  if (status === "CLOSING_SOON") return "Closing Soon";
  return "Active";
}

export function getJobStatusClass(lastDate: Date | string): string {
  const status = getJobStatus(lastDate);
  if (status === "EXPIRED") return "bg-red-100 text-red-700";
  if (status === "CLOSING_SOON") return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}
