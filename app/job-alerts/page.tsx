"use client";

import { useState } from "react";

export default function JobAlertsPage() {

  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Government Jobs");
  const [message, setMessage] = useState("");

  async function subscribe(e: React.FormEvent) {

    e.preventDefault();

    if (!email.trim()) {
      setMessage("Please enter your email address.");
      return;
    }

    if (!email.includes("@")) {
      setMessage("Please enter a valid email address.");
      return;
    }

    setMessage("Saving…");
    try {
      const response = await fetch("/api/job-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          categories: category === "All Jobs" ? [] : [category],
          keywords: [],
          locations: [],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save preference.");
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save preference.");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">

      <section className="mx-auto max-w-5xl px-4 py-12">

        <div className="rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-700 p-8 text-white shadow-xl md:p-12">

          <div className="max-w-2xl">

            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
              🔔 FREE JOB ALERTS
            </span>

            <h1 className="mt-5 text-3xl font-black md:text-5xl">
              Never miss an important job notification.
            </h1>

            <p className="mt-4 text-blue-100">
              Get notified about new government jobs, private vacancies,
              results, admit cards and important exam updates.
            </p>

          </div>

        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-3xl">🏛️</div>
            <h2 className="mt-3 font-bold">Government Jobs</h2>
            <p className="mt-2 text-sm text-gray-500">
              SSC, Railway, Banking, PSU and state government vacancies.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-3xl">💼</div>
            <h2 className="mt-3 font-bold">Private Jobs</h2>
            <p className="mt-2 text-sm text-gray-500">
              Private sector vacancies and company recruitment updates.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-3xl">🏆</div>
            <h2 className="mt-3 font-bold">Exam Updates</h2>
            <p className="mt-2 text-sm text-gray-500">
              Results, admit cards, answer keys and syllabus updates.
            </p>
          </div>

        </div>

        <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm md:p-8">

          <h2 className="text-2xl font-bold">
            Subscribe for Job Alerts
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Choose the type of jobs you want to follow.
          </p>

          <form
            onSubmit={subscribe}
            className="mt-6 space-y-5"
          >

            <div>

              <label className="mb-2 block text-sm font-semibold">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>

            <div>

              <label className="mb-2 block text-sm font-semibold">
                Job Type
              </label>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option>Government Jobs</option>
                <option>Private Jobs</option>
                <option>All Jobs</option>
              </select>

            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
            >
              🔔 Activate Job Alerts
            </button>

          </form>

          {message && (
            <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
              {message}
            </div>
          )}

        </div>

      </section>

    </main>
  );
}
