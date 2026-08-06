"use client";

import { useState } from "react";
import { jobs } from "../data/jobs";
import JobCard from "../components/JobCard";
import SearchBar from "../components/SearchBar";

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [qualification, setQualification] = useState("All");

  const filteredJobs = jobs.filter((job) => {
    const text = search.toLowerCase();

    const matchesSearch =
      job.title.toLowerCase().includes(text) ||
      job.department.toLowerCase().includes(text) ||
      job.qualification.toLowerCase().includes(text);

    const matchesQualification =
      qualification === "All" || job.qualification === qualification;

    return matchesSearch && matchesQualification;
  });

  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">
        Latest Government Jobs
      </h1>

      <SearchBar onSearch={setSearch} />

      {/* Qualification Filter */}
      <div className="mb-8">
        <select
          value={qualification}
          onChange={(e) => setQualification(e.target.value)}
          className="border rounded-lg p-3 text-lg w-full md:w-80"
        >
          <option value="All">All Qualifications</option>
          <option value="10th Pass">10th Pass</option>
          <option value="12th Pass">12th Pass</option>
          <option value="ITI">ITI</option>
          <option value="Diploma">Diploma</option>
          <option value="Graduate">Graduate</option>
          <option value="B.Tech">B.Tech</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredJobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {filteredJobs.length === 0 && (
        <div className="text-center mt-10 text-red-600 text-xl font-semibold">
          No Jobs Found
        </div>
      )}
    </main>
  );
}