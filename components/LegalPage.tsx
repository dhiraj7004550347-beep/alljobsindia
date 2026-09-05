import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5"><Link href="/" className="text-xl font-black text-blue-800">All Jobs India</Link><Link href="/jobs" className="text-sm font-bold text-blue-700">Browse Jobs</Link></div></header>
      <article className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-4xl font-black text-slate-950">{title}</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">{intro}</p>
        <div className="legal-copy mt-9 space-y-7 rounded-2xl border bg-white p-6 shadow-sm md:p-9">{children}</div>
        <p className="mt-6 text-sm text-slate-500">Last updated: 24 August 2026</p>
      </article>
      <PublicFooter />
    </main>
  );
}
