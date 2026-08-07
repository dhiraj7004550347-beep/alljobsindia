export default function NewJobPage() {
  return (
    <div className="max-w-4xl">

      <h1 className="text-4xl font-bold mb-8">
        Add New Job
      </h1>

      <form className="space-y-5 bg-white p-8 rounded-xl shadow">

        <input
          type="text"
          placeholder="Job Title"
          className="w-full border p-3 rounded-lg"
        />

        <input
          type="text"
          placeholder="Department"
          className="w-full border p-3 rounded-lg"
        />

        <input
          type="text"
          placeholder="Qualification"
          className="w-full border p-3 rounded-lg"
        />

        <input
          type="text"
          placeholder="Vacancy"
          className="w-full border p-3 rounded-lg"
        />

        <input
          type="text"
          placeholder="Salary"
          className="w-full border p-3 rounded-lg"
        />

        <input
          type="date"
          className="w-full border p-3 rounded-lg"
        />

        <button
          className="bg-blue-700 text-white px-8 py-3 rounded-lg hover:bg-blue-800"
        >
          Save Job
        </button>

      </form>

    </div>
  );
}