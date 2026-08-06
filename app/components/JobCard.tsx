import Link from "next/link";
import type { Job } from "../types/job";

type Props = {
  job: Job;
};

export default function JobCard({ job }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition duration-300 p-6 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800">
        {job.title}
      </h2>

      <div className="mt-4 space-y-2 text-gray-600">
        <p>
          <strong>Department:</strong> {job.department}
        </p>

        <p>
          <strong>Qualification:</strong> {job.qualification}
        </p>

        <p>
          <strong>Vacancy:</strong> {job.vacancy}
        </p>

        <p>
          <strong>Last Date:</strong> {job.lastDate}
        </p>
      </div>

      <Link
        href={`/jobs/${job.id}`}
        className="inline-block mt-6 bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 rounded-lg transition"
      >
        View Details
      </Link>
    </div>
  );
}