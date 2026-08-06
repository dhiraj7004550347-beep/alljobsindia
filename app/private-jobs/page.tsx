const privateJobs = [
  {
    id: 1,
    company: "TCS",
    title: "Software Engineer",
    location: "Bangalore",
    salary: "₹6 LPA",
  },
  {
    id: 2,
    company: "Infosys",
    title: "System Engineer",
    location: "Pune",
    salary: "₹5 LPA",
  },
  {
    id: 3,
    company: "Wipro",
    title: "Graduate Trainee",
    location: "Hyderabad",
    salary: "₹4.5 LPA",
  },
];

export default function PrivateJobsPage() {
  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-4xl font-bold text-blue-700 mb-8">
        Latest Private Jobs
      </h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {privateJobs.map((job) => (
          <div key={job.id} className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold">{job.title}</h2>

            <p className="mt-2">
              <strong>Company:</strong> {job.company}
            </p>

            <p>
              <strong>Location:</strong> {job.location}
            </p>

            <p>
              <strong>Salary:</strong> {job.salary}
            </p>

            <button className="mt-5 bg-blue-700 text-white px-5 py-2 rounded-lg">
              View Details
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}