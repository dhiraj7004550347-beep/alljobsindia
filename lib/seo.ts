import { SITE_CONFIG, absoluteUrl } from "@/lib/site-config";

export function createJobMetadata(job: {
  id: number;
  title: string;
  department?: string | null;
  qualification?: string | null;
  location?: string | null;
  category?: string | null;
}) {
  const title = job.title;

  const description = [
    job.title,
    job.department,
    job.qualification,
    job.location,
    job.category,
    "Official notification, eligibility and application details."
  ]
    .filter(Boolean)
    .join(" | ");

  const url = absoluteUrl(`/jobs/${job.id}`);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_CONFIG.name,
      type: "article" as const,
      locale: SITE_CONFIG.language,
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
    },
  };
}
