const results = [
  {
    id: 1,
    title: "SSC CGL Result 2026",
    date: "15 Sep 2026",
  },
  {
    id: 2,
    title: "Railway Group D Result",
    date: "20 Sep 2026",
  },
  {
    id: 3,
    title: "UPSC Civil Services Result",
    date: "25 Sep 2026",
  },
];

export default function ResultsPage() {
  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-blue-700">
        Latest Results
      </h1>

      <div className="space-y-5">
        {results.map((result) => (
          <div
            key={result.id}
            className="bg-white shadow-lg rounded-xl p-6 flex justify-between items-center"
          >
            <div>
              <h2 className="text-2xl font-bold">{result.title}</h2>
              <p className="text-gray-600 mt-2">
                Result Date: {result.date}
              </p>
            </div>

            <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
              View Result
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}