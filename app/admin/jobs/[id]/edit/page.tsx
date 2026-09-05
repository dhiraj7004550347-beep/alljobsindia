import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobById } from "../../../../../actions/jobs";
import JobForm from "../../../../../components/JobForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditJobPage({ params }: PageProps) {
  const { id } = await params;
  const jobId = Number(id);

  if (!Number.isInteger(jobId) || jobId <= 0) {
    notFound();
  }

  const job = await getJobById(jobId);

  if (!job) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">
                Admin Panel
              </p>

              <h1 className="text-3xl font-bold text-gray-900">
                Edit Job
              </h1>

              <p className="text-gray-600 mt-1">
                Update job #{job.id} and save the changes.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/admin/jobs"
                className="bg-gray-700 text-white px-5 py-3 rounded-lg font-semibold"
              >
                ← Back
              </Link>

              {job.status === "PUBLISHED" && (
                <Link
                  href={`/jobs/${job.id}`}
                  target="_blank"
                  className="bg-blue-600 text-white px-5 py-3 rounded-lg font-semibold"
                >
                  View Public Page
                </Link>
              )}
            </div>
          </div>
        </div>

        <JobForm
          initialData={{
            id: job.id,
            title: job.title,
            department: job.department || "",
            qualification: job.qualification || "",
            vacancy: job.vacancy || "",
            salary: job.salary || "",
            ageLimit: job.ageLimit || "",
            location: job.location || "",
            applicationFee: job.applicationFee || "",
            selectionProcess: job.selectionProcess || "",
            description: job.description || "",
            howToApply: job.howToApply || "",
            applicationStartDate: job.applicationStartDate?.toISOString().slice(0, 10) || "",
            lastDate: job.lastDate?.toISOString().slice(0, 10) || "",
            applyLink: job.applyLink || "",
            notificationLink: job.notificationLink || "",
            officialWebsite: job.officialWebsite || "",
            category: job.category,
            status: job.status,
            featured: job.featured,
          }}
        />
      </div>
    </main>
  );
}
