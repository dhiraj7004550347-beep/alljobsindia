import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4">

      <div className="bg-white rounded-2xl shadow-lg p-10 md:p-14 text-center max-w-lg w-full">

        <div className="text-7xl mb-5">
          🔍
        </div>

        <h1 className="text-5xl font-bold text-gray-900">
          404
        </h1>

        <h2 className="text-2xl font-bold mt-4">
          Page Not Found
        </h2>

        <p className="text-gray-600 mt-3">
          Sorry, the page or job you are looking for
          does not exist.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">

          <Link
            href="/"
            className="bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800"
          >
            Go to Home
          </Link>

          <Link
            href="/jobs"
            className="border border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50"
          >
            Browse Jobs
          </Link>

        </div>

      </div>

    </main>
  );
}