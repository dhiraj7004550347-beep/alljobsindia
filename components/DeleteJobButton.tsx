"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteJobButton({
  id,
}: {
  id: number;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this job?\n\nThis action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Unable to delete job.");
      }

      router.refresh();
    } catch (error) {
      console.error(error);

      alert("Unable to delete job.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="bg-red-600 text-white px-5 py-2 rounded-lg text-center font-semibold hover:bg-red-700 disabled:opacity-50"
    >
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
