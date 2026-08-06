import Link from "next/link";
import Footer from "./components/Footer";
import { jobs } from "./data/jobs";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100">

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white py-20 text-center">
        <h1 className="text-5xl font-bold">
          Welcome to AllJobsIndia
        </h1>

        <p className="mt-5 text-xl">
          Government Jobs • Private Jobs • Results • Admit Card
        </p>

        <Link
          href="/jobs"
          className="inline-block mt-8 bg-white text-blue-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
        >
          Explore Jobs
        </Link>
      </section>

      {/* Search */}
      <section className="max-w-5xl mx-auto mt-10 px-5">
        <input
          type="text"
          placeholder="Search Government Jobs..."
          className="w-full border rounded-lg p-4 text-lg shadow-sm"
        />
      </section>

      {/* Latest Notifications */}
      <section className="max-w-6xl mx-auto mt-10 px-5">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-5 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-3">
            📢 Latest Notifications
          </h2>

          <ul className="space-y-2 text-blue-700 font-medium">
            <li>• SSC CGL 2026 Notification Released</li>
            <li>• Railway Group D Online Form Started</li>
            <li>• UPSC Civil Services Registration Open</li>
            <li>• IBPS PO Recruitment 2026 Coming Soon</li>
          </ul>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto mt-12 px-5">
        <h2 className="text-3xl font-bold mb-6">
          Browse Categories
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">

          <Link
            href="/jobs"
            className="bg-white rounded-xl shadow p-6 text-center font-semibold hover:bg-blue-700 hover:text-white transition"
          >
            Government Jobs
          </Link>

          <Link
            href="/private-jobs"
            className="bg-white rounded-xl shadow p-6 text-center font-semibold hover:bg-blue-700 hover:text-white transition"
          >
            Private Jobs
          </Link>

          <Link
            href="/results"
            className="bg-white rounded-xl shadow p-6 text-center font-semibold hover:bg-blue-700 hover:text-white transition"
          >
            Results
          </Link>

          <Link
            href="/admit-card"
            className="bg-white rounded-xl shadow p-6 text-center font-semibold hover:bg-blue-700 hover:text-white transition"
          >
            Admit Card
          </Link>

        </div>
      </section>

      {/* Latest Government Jobs */}
      <section className="max-w-6xl mx-auto mt-12 px-5">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">
            Latest Government Jobs
          </h2>

          <Link
            href="/jobs"
            className="bg-blue-700 text-white px-5 py-2 rounded-lg hover:bg-blue-800"
          >
            View All Jobs
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {jobs.slice(0, 3).map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-xl shadow p-5 hover:shadow-xl transition"
            >
              <h3 className="text-xl font-bold">
                {job.title}
              </h3>

              <p className="mt-2 text-gray-600">
                <strong>Qualification:</strong> {job.qualification}
              </p>

              <p className="mt-2 text-gray-600">
                <strong>Last Date:</strong> {job.lastDate}
              </p>

              <Link
                href={`/jobs/${job.id}`}
                className="inline-block mt-4 text-blue-700 font-semibold"
              >
                View Details →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Statistics */}
      <section className="max-w-6xl mx-auto mt-16 px-5">
        <h2 className="text-3xl font-bold text-center mb-8">
          Website Statistics
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

          <div className="bg-white rounded-xl shadow p-6 text-center">
            <h3 className="text-4xl font-bold text-blue-700">2500+</h3>
            <p className="mt-2">Government Jobs</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6 text-center">
            <h3 className="text-4xl font-bold text-green-600">850+</h3>
            <p className="mt-2">Results</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6 text-center">
            <h3 className="text-4xl font-bold text-red-600">500+</h3>
            <p className="mt-2">Admit Cards</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6 text-center">
            <h3 className="text-4xl font-bold text-purple-600">100K+</h3>
            <p className="mt-2">Monthly Visitors</p>
          </div>

        </div>
      </section>

      <Footer />

    </main>
  );
}