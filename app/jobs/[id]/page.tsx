import { jobs } from "../../data/jobs";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JobDetails({ params }: Props) {
  const { id } = await params;

  const job = jobs.find((j) => j.id === Number(id));

  if (!job) {
    return (
      <main className="max-w-5xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-red-600">
          Job Not Found
        </h1>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="bg-white rounded-xl shadow-lg p-8">

        <h1 className="text-4xl font-bold text-blue-700 mb-6">
          {job.title}
        </h1>

        <div className="space-y-3 text-lg">
          <p><strong>Department:</strong> {job.department}</p>
          <p><strong>Qualification:</strong> {job.qualification}</p>
          <p><strong>Vacancy:</strong> {job.vacancy}</p>
          <p><strong>Salary:</strong> {job.salary}</p>
          <p><strong>Age Limit:</strong> {job.age}</p>
          <p><strong>Job Location:</strong> {job.location}</p>
          <p><strong>Application Fee:</strong> {job.applicationFee}</p>
          <p><strong>Selection Process:</strong> {job.selectionProcess}</p>
          <p><strong>Last Date:</strong> {job.lastDate}</p>
        </div>

        <div className="flex gap-4 mt-8 flex-wrap">
          <a
            href={job.applyLink}
            target="_blank"
            className="bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            Apply Online
          </a>

          <a
            href={job.notificationLink}
            target="_blank"
            className="bg-red-600 text-white px-6 py-3 rounded-lg"
          >
            Official Notification
          </a>

          <a
            href={job.officialWebsite}
            target="_blank"
            className="bg-blue-700 text-white px-6 py-3 rounded-lg"
          >
            Official Website
          </a>
        </div>

      </div>
    </main>
  );
}