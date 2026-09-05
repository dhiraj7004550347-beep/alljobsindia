"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page rendering failed", error.digest || "No error digest was provided");
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-lg sm:p-12">
        <div className="text-5xl" aria-hidden="true">⚠️</div>
        <h1 className="mt-5 text-3xl font-black text-slate-950">This page is temporarily unavailable</h1>
        <p className="mt-3 leading-7 text-slate-600">The service could not load its data. Please try again. If the problem continues, the site administrator should check the database health page.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white">Try Again</button>
          <Link href="/" className="rounded-xl border px-6 py-3 font-bold text-slate-700">Go to Home</Link>
        </div>
      </section>
    </main>
  );
}
