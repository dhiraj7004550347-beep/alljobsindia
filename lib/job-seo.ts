import { absoluteUrl } from "@/lib/site-config";

function isoDate(value?: Date | string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function createJobStructuredData(job: {
  title: string;
  description: string;
  organization?: string | null;
  officialWebsite?: string | null;
  location?: string | null;
  lastDate?: Date | string | null;
  datePosted?: Date | string | null;
  sourceJobId?: string | null;
  jobPagePath: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    ...(isoDate(job.datePosted) ? { datePosted: isoDate(job.datePosted) } : {}),
    ...(isoDate(job.lastDate) ? { validThrough: isoDate(job.lastDate) } : {}),
    ...(job.organization
      ? {
          hiringOrganization: {
            "@type": "Organization",
            name: job.organization,
            ...(job.officialWebsite ? { sameAs: job.officialWebsite } : {}),
          },
        }
      : {}),
    ...(job.location
      ? {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location,
              addressCountry: "IN",
            },
          },
        }
      : {}),
    ...(job.sourceJobId && job.organization
      ? {
          identifier: {
            "@type": "PropertyValue",
            name: job.organization,
            value: job.sourceJobId,
          },
        }
      : {}),
    url: absoluteUrl(job.jobPagePath),
  };
}
