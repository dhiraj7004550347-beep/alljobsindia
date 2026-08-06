const answerKeys = [
  {
    id: 1,
    title: "SSC CGL Answer Key 2026",
    date: "22 Aug 2026",
  },
  {
    id: 2,
    title: "Railway Group D Answer Key",
    date: "28 Aug 2026",
  },
  {
    id: 3,
    title: "UPSC Prelims Answer Key",
    date: "05 Sep 2026",
  },
];

export default function AnswerKeyPage() {
  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-blue-700">
        Latest Answer Keys
      </h1>

      <div className="space-y-5">
        {answerKeys.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow-lg p-6 flex justify-between items-center"
          >
            <div>
              <h2 className="text-2xl font-bold">{item.title}</h2>
              <p className="text-gray-600 mt-2">
                Release Date: {item.date}
              </p>
            </div>

            <button className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700">
              View Answer Key
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}