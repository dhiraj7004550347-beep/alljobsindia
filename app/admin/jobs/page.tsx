import Link from "next/link";
import { getAllJobs } from "../../../actions/jobs";
import JobStatusBadge from "../../../components/JobStatusBadge";

export default async function AdminJobsPage() {
  const jobs = await getAllJobs();

  const governmentJobs = jobs.filter((job) =>
    job.category?.toLowerCase().includes("government")
  );

  const privateJobs = jobs.filter((job) =>
    job.category?.toLowerCase().includes("private")
  );

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div>
              <p className="text-sm text-gray-500">
                All Jobs India
              </p>

              <h1 className="text-3xl font-bold text-gray-900 mt-1">
                Manage Jobs
              </h1>

              <p className="text-gray-600 mt-1">
                Manage all government and private job vacancies.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <Link
                href="/admin"
                className="bg-gray-700 text-white px-5 py-3 rounded-lg font-semibold hover:bg-gray-800"
              >
                ← Dashboard
              </Link>

              <Link
                href="/admin/new-job"
                className="bg-green-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-green-700"
              >
                + Add New Job
              </Link>

            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-gray-500">
              Total Jobs
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {jobs.length}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-gray-500">
              Government Jobs
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {governmentJobs.length}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-gray-500">
              Private Jobs
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {privateJobs.length}
            </h2>
          </div>

        </div>

        {/* Jobs */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">

          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">
              All Jobs
            </h2>

            <p className="text-gray-600 mt-1">
              View and manage existing job vacancies.
            </p>
          </div>

          {jobs.length === 0 ? (

            <div className="p-12 text-center">

              <div className="text-5xl mb-4">
                📋
              </div>

              <h3 className="text-xl font-bold">
                No Jobs Found
              </h3>

              <p className="text-gray-600 mt-2">
                Add your first job vacancy to get started.
              </p>

              <Link
                href="/admin/new-job"
                className="inline-block mt-5 bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800"
              >
                + Add First Job
              </Link>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50 border-b">
                  <tr>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">
                      #
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">
                      Job
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">
                      Category
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">
                      Vacancy
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">
                      Location
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">
                      Last Date
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>

                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y">

                  {jobs.map((job) => (

                    <tr
                      key={job.id}
                      className="hover:bg-gray-50"
                    >

                      <td className="px-6 py-5 text-gray-600">
                        #{job.id}
                      </td>

                      <td className="px-6 py-5">
                        <h3 className="font-bold text-gray-900">
                          {job.title}
                        </h3>

                        <p className="text-sm text-gray-500 mt-1">
                          {job.department || "Not specified"}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                          {job.category}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-gray-700">
                        {job.vacancy || "Not specified"}
                      </td>

                      <td className="px-6 py-5 text-gray-700">
                        {job.location || "Not specified"}
                      </td>

                      <td className="px-6 py-5 text-gray-700">
                        {job.lastDate ? new Date(job.lastDate).toLocaleDateString("en-IN") : "Not specified"}
                      </td>

                      <td className="px-6 py-5">
                        <JobStatusBadge
                          lastDate={job.lastDate}
                          status={job.status}
                        />
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex justify-end gap-2">

                          {job.status === "PUBLISHED" && (
                            <Link
                              href={`/jobs/${job.id}`}
                              target="_blank"
                              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200"
                            >
                              View
                            </Link>
                          )}

                          <Link
                            href={`/admin/jobs/${job.id}`}
                            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
                          >
                            Manage
                          </Link>

                        </div>
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>
    </main>
  );
}
