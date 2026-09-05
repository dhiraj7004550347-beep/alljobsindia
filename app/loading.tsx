export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">

      <div className="text-center">

        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto" />

        <p className="text-gray-600 mt-4 font-semibold">
          Loading jobs...
        </p>

      </div>

    </main>
  );
}