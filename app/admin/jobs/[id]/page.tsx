import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import DeleteJobButton from "../../../../components/DeleteJobButton";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminJobDetailsPage({
  params,
}: PageProps) {
  const { id } = await params;

  const jobId = Number(id);

  if (Number.isNaN(jobId)) {
    notFound();
  }

  const job = await prisma.job.findUnique({
    where: {
      id: jobId,
    },
  });

  if (!job) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-6 mb-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>
              <p className="text-sm text-gray-500">
                All Jobs India / Admin
              </p>

              <h1 className="text-3xl font-bold text-gray-900 mt-1">
                Manage Job
              </h1>

              <p className="text-gray-600 mt-1">
                Job ID: #{job.id}
              </p>
            </div>

            <div className="flex gap-3">

              <Link
                href="/admin/jobs"
                className="bg-gray-700 text-white px-5 py-3 rounded-lg font-semibold hover:bg-gray-800"
              >
                ← Back
              </Link>

              {job.status === "PUBLISHED" && <Link
                href={`/jobs/${job.id}`}
                target="_blank"
                className="bg-green-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-green-700"
              >
                View Job
              </Link>}

              <Link
                href={`/admin/jobs/${job.id}/edit`}
                className="bg-amber-500 text-white px-5 py-3 rounded-lg font-semibold hover:bg-amber-600"
              >
                Edit Job
              </Link>

            </div>

            <div className="mt-8 border-t pt-6">
              <h3 className="mb-2 text-lg font-bold text-red-700">Danger zone</h3>
              <p className="mb-4 text-sm text-gray-600">Deletion is explicit and permanent. Archiving is preferred when historical data should be retained.</p>
              <DeleteJobButton id={job.id} />
            </div>

          </div>

        </div>

        {/* Job Details */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">

          <div className="p-6 border-b bg-gray-50">

            <h2 className="text-2xl font-bold text-gray-900">
              {job.title}
            </h2>

            <p className="text-gray-600 mt-1">
              {job.department}
            </p>

          </div>

          <div className="p-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div>
                <p className="text-sm text-gray-500">
                  Category
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {job.category}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Vacancy
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {job.vacancy || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Qualification
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {job.qualification || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Location
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {job.location || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Salary
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {job.salary || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Age Limit
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {job.ageLimit || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Application Fee
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {job.applicationFee || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Selection Process
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {job.selectionProcess || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Last Date
                </p>

                <p className="font-semibold text-red-600 mt-1">
                  {job.lastDate ? new Date(job.lastDate).toLocaleDateString("en-IN") : "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Created
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {new Date(job.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>

            </div>

            {/* Links */}
            <div className="mt-8 pt-6 border-t">

              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Important Links
              </h3>

              <div className="flex flex-wrap gap-3">

                {job.applyLink && <a
                  href={job.applyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-green-700"
                >
                  Apply Online
                </a>}

                {job.notificationLink && <a
                  href={job.notificationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-blue-700"
                >
                  Notification
                </a>}

                {job.officialWebsite && <a
                  href={job.officialWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-700 text-white px-5 py-3 rounded-lg font-semibold hover:bg-gray-800"
                >
                  Official Website
                </a>}

              </div>

            </div>

          </div>

        </div>

      </div>
    </main>
  );
}
