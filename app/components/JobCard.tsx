import Link from "next/link";

type Job = {
  id: number;
  title: string;
  department: string;
  lastDate: string;
};

export default function JobCard({ job }: { job: Job }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      <h2 className="text-2xl font-bold">{job.title}</h2>

      <p className="mt-2 text-gray-600">
        Department: {job.department}
      </p>

      <p className="text-gray-600">
        Last Date: {job.lastDate}
      </p>

      <Link href={`/jobs/${job.id}`}>
        <button className="mt-5 bg-blue-700 text-white px-5 py-2 rounded-lg">
          View Details
        </button>
      </Link>
    </div>
  );
}