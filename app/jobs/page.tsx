import { jobs } from "../data/jobs";
import JobCard from "../components/JobCard";

export default function JobsPage() {
  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">
        Latest Government Jobs
      </h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </main>
  );
}