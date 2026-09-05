export type JobAlertPreference = {
  id: string;
  email?: string;
  keywords: string[];
  categories: string[];
  locations: string[];
  qualification?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AlertJob = {
  title?: string | null;
  department?: string | null;
  qualification?: string | null;
  location?: string | null;
  category?: string | null;
};

export function jobMatchesAlert(
  job: AlertJob,
  preference: JobAlertPreference
): boolean {
  if (!preference.active) {
    return false;
  }

  const haystack = [
    job.title,
    job.department,
    job.qualification,
    job.location,
    job.category,
  ]
    .map((value) => String(value || ""))
    .join(" ")
    .toLowerCase();

  const keywordMatch =
    preference.keywords.length === 0 ||
    preference.keywords.some(
      (keyword) =>
        haystack.includes(
          keyword.toLowerCase()
        )
    );

  const categoryMatch =
    preference.categories.length === 0 ||
    preference.categories.some(
      (category) =>
        String(job.category || "")
          .toLowerCase()
          .includes(
            category.toLowerCase()
          )
    );

  const locationMatch =
    preference.locations.length === 0 ||
    preference.locations.some(
      (location) =>
        String(job.location || "")
          .toLowerCase()
          .includes(
            location.toLowerCase()
          )
    );

  const qualificationMatch =
    !preference.qualification ||
    String(job.qualification || "")
      .toLowerCase()
      .includes(
        preference.qualification.toLowerCase()
      );

  return (
    keywordMatch &&
    categoryMatch &&
    locationMatch &&
    qualificationMatch
  );
}
