const admitCards = [
  {
    id: 1,
    title: "SSC CGL Admit Card 2026",
    date: "01 Aug 2026",
  },
  {
    id: 2,
    title: "Railway Group D Admit Card",
    date: "10 Aug 2026",
  },
  {
    id: 3,
    title: "UPSC Civil Services Admit Card",
    date: "15 Aug 2026",
  },
];

export default function AdmitCardPage() {
  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-blue-700">
        Latest Admit Cards
      </h1>

      <div className="space-y-5">
        {admitCards.map((card) => (
          <div
            key={card.id}
            className="bg-white shadow-lg rounded-xl p-6 flex justify-between items-center"
          >
            <div>
              <h2 className="text-2xl font-bold">{card.title}</h2>
              <p className="text-gray-600 mt-2">
                Release Date: {card.date}
              </p>
            </div>

            <button className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700">
              Download Admit Card
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}