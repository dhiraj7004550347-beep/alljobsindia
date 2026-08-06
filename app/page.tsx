import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100">

      {/* Hero Section */}
      <section className="bg-blue-700 text-white py-20 text-center">
        <h1 className="text-5xl font-bold">
          Welcome to AllJobsIndia
        </h1>

        <p className="mt-5 text-xl">
          Government Jobs • Private Jobs • Results • Admit Card
        </p>

        <Link
          href="/jobs"
          className="inline-block mt-8 bg-white text-blue-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-200"
        >
          Explore Jobs
        </Link>
      </section>

      {/* Search */}
      <section className="max-w-5xl mx-auto mt-10 px-5">
        <input
          type="text"
          placeholder="Search Government Jobs..."
          className="w-full border rounded-lg p-4 text-lg"
        />
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto mt-12 px-5">
        <h2 className="text-3xl font-bold mb-6">
          Browse Categories
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">

          <div className="bg-white rounded-xl shadow p-6 text-center font-semibold">
            Government Jobs
          </div>

          <div className="bg-white rounded-xl shadow p-6 text-center font-semibold">
            Private Jobs
          </div>

          <div className="bg-white rounded-xl shadow p-6 text-center font-semibold">
            Results
          </div>

          <div className="bg-white rounded-xl shadow p-6 text-center font-semibold">
            Admit Card
          </div>

        </div>
      </section>

      {/* Latest Jobs */}
      <section className="max-w-6xl mx-auto mt-12 px-5 pb-20">
        <h2 className="text-3xl font-bold mb-6">
          Latest Government Jobs
        </h2>

        <Link
          href="/jobs"
          className="bg-blue-700 text-white px-6 py-3 rounded-lg"
        >
          View All Jobs
        </Link>
      </section>

    </main>
  );
}