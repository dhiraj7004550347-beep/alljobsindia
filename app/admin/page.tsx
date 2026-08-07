export default function ManageJobsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">
          Manage Jobs
        </h1>

        <a
          href="/admin/new-job"
          className="bg-blue-700 text-white px-5 py-3 rounded-lg"
        >
          + Add New Job
        </a>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-4 text-left">Job Title</th>

              <th className="p-4 text-left">Department</th>

              <th className="p-4 text-left">Last Date</th>

              <th className="p-4 text-left">Action</th>

            </tr>

          </thead>

          <tbody>

            <tr>

              <td className="p-4">
                No Jobs Found
              </td>

              <td>-</td>

              <td>-</td>

              <td>-</td>

            </tr>

          </tbody>

        </table>

      </div>

    </div>
  );
}