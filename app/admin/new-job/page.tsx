import Link from "next/link";
import JobForm from "../../../components/JobForm";

export default function NewJobPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-6">
          <Link
            href="/admin/jobs"
            className="text-blue-700 font-semibold"
          >
            ← Back to Manage Jobs
          </Link>

          <h1 className="text-3xl font-bold mt-4">
            Add New Job
          </h1>

          <p className="text-gray-600 mt-1">
            Create a new government or private job vacancy.
          </p>
        </div>

        <JobForm />

      </div>
    </main>
  );
}