import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

export default function ResourcePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 text-white"><div className="mx-auto max-w-5xl px-4 py-14"><Link href="/" className="text-sm font-semibold text-blue-200">← Home</Link><h1 className="mt-5 text-4xl font-black sm:text-5xl">{title}</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-blue-50">{description}</p></div></section>
      <section className="mx-auto max-w-5xl px-4 py-12"><div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-2xl font-black">No verified updates published</h2><p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">This section will show records only after a dedicated verified data source is implemented. AllJobsIndia does not publish placeholder exam notices as real updates.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/jobs" className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Browse verified jobs</Link><Link href="/disclaimer" className="rounded-xl border px-5 py-3 font-bold">Read disclaimer</Link></div></div><div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><strong>Important:</strong> Use the relevant examination authority&apos;s official website for current dates, downloads and notices.</div></section>
      <PublicFooter />
    </main>
  );
}
