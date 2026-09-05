"use client";

import { useRef, useState } from "react";

export default function JobBackup() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function downloadBackup() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch("/api/jobs/export");

      if (!response.ok) {
        throw new Error("Backup failed");
      }

      const jobs = await response.json();

      const blob = new Blob(
        [JSON.stringify(jobs, null, 2)],
        {
          type: "application/json",
        }
      );

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      const date = new Date()
        .toISOString()
        .split("T")[0];

      link.download = `all-jobs-india-backup-${date}.json`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(url);

      setMessage(
        `Backup downloaded successfully. ${jobs.length} jobs saved.`
      );
    } catch (error) {
      console.error("Backup error:", error);

      setMessage("Backup download failed.");
    } finally {
      setLoading(false);
    }
  }

  async function restoreBackup(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const text = await file.text();

      const jobs = JSON.parse(text);

      if (!Array.isArray(jobs)) {
        throw new Error("Invalid backup file");
      }

      const confirmed = window.confirm(
        `Restore ${jobs.length} jobs from this backup?`
      );

      if (!confirmed) {
        return;
      }

      const response = await fetch("/api/jobs/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jobs),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Restore failed"
        );
      }

      setMessage(
        `Restore successful. ${result.imported} jobs restored.`
      );

      setTimeout(() => {
        window.location.reload();
      }, 1200);

    } catch (error) {
      console.error("Restore error:", error);

      setMessage(
        "Invalid backup file or restore failed."
      );

    } finally {
      setLoading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6">

      <h2 className="text-2xl font-bold">
        Job Database Backup
      </h2>

      <p className="text-gray-600 mt-2">
        Download your jobs as a JSON backup or restore
        previously saved jobs.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mt-6">

        <button
          type="button"
          onClick={downloadBackup}
          disabled={loading}
          className="bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
        >
          {loading
            ? "Please wait..."
            : "⬇ Download Backup"}
        </button>

        <button
          type="button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={loading}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          ⬆ Restore Backup
        </button>

      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={restoreBackup}
        className="hidden"
      />

      {message && (
        <div className="mt-5 bg-gray-100 rounded-lg p-4">
          <p className="font-semibold">
            {message}
          </p>
        </div>
      )}

    </div>
  );
}