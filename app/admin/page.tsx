import Link from "next/link";
import { getAllJobs } from "../../actions/jobs";

export default async function AdminDashboard() {
  const jobs = await getAllJobs();

  const published = jobs.filter(
    (job) => job.status === "PUBLISHED"
  );

  const drafts = jobs.filter(
    (job) => job.status === "DRAFT"
  );

  const featured = jobs.filter(
    (job) => job.featured
  );

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        <div className="bg-white rounded-2xl shadow p-6 mb-8">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div>
              <h1 className="text-4xl font-bold">
                All Jobs India
              </h1>

              <p className="text-gray-600 mt-2">
                Admin Dashboard
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <Link
                href="/admin/jobs"
                className="bg-blue-700 text-white px-5 py-3 rounded-lg font-semibold"
              >
                Manage Jobs
              </Link>

              <Link
                href="/admin/new-job"
                className="bg-green-600 text-white px-5 py-3 rounded-lg font-semibold"
              >
                + Add Job
              </Link>

              <Link
                href="/admin/backup"
                className="bg-purple-600 text-white px-5 py-3 rounded-lg font-semibold"
              >
                💾 Backup
              </Link>

              <Link
                href="/admin/automation"
                className="bg-slate-900 text-white px-5 py-3 rounded-lg font-semibold"
              >
                ⚙ Automation
              </Link>

              <Link
                href="/admin/analytics"
                className="bg-cyan-700 text-white px-5 py-3 rounded-lg font-semibold"
              >
                📊 Analytics
              </Link>

              <Link
                href="/admin/job-tools"
                className="bg-amber-600 text-white px-5 py-3 rounded-lg font-semibold"
              >
                🛠 Job Tools
              </Link>

              <form
                action="/api/admin/login/logout"
                method="POST"
              >
                <button
                  type="submit"
                  className="bg-red-600 text-white px-5 py-3 rounded-lg font-semibold"
                >
                  Logout
                </button>
              </form>

            </div>

          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">

          <Stat
            title="Total Jobs"
            value={jobs.length}
          />

          <Stat
            title="Published"
            value={published.length}
          />

          <Stat
            title="Drafts"
            value={drafts.length}
          />

          <Stat
            title="Featured"
            value={featured.length}
          />

        </div>

        <div className="bg-white rounded-2xl shadow p-6">

          <div className="flex items-center justify-between mb-6">

            <div>
              <h2 className="text-2xl font-bold">
                Recent Jobs
              </h2>

              <p className="text-gray-600 mt-1">
                Latest jobs added to database
              </p>
            </div>

            <Link
              href="/admin/jobs"
              className="text-blue-700 font-semibold"
            >
              View All →
            </Link>

          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-10">

              <p className="text-gray-500">
                No jobs found.
              </p>

              <Link
                href="/admin/new-job"
                className="inline-block mt-4 bg-blue-700 text-white px-6 py-3 rounded-lg"
              >
                Add First Job
              </Link>

            </div>
          ) : (
            <div className="space-y-4">

              {jobs.slice(0, 5).map((job) => (

                <div
                  key={job.id}
                  className="border rounded-xl p-5"
                >

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                    <div>

                      <div className="flex flex-wrap gap-2">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                          {job.category}
                        </span>

                        <span className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                          {job.status}
                        </span>

                        {job.featured && (
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
                            ⭐ Featured
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold mt-3">
                        {job.title}
                      </h3>

                      <p className="text-gray-600">
                        {job.department}
                      </p>

                      <p className="text-sm text-gray-500 mt-2">
                        Vacancy: {job.vacancy} ·{" "}
                        {job.location}
                      </p>

                    </div>

                    <div className="flex gap-2">

                      <Link
                        href={`/admin/jobs/${job.id}`}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        View
                      </Link>

                      <Link
                        href={`/admin/jobs/${job.id}/edit`}
                        className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        Edit
                      </Link>

                    </div>

                  </div>

                </div>

              ))}

            </div>
          )}

        </div>

      </div>
    </main>
  );
}

function Stat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <p className="text-gray-500">
        {title}
      </p>

      <p className="text-3xl font-bold mt-2">
        {value}
      </p>
    </div>
  );
}
