import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-9 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="font-black text-white">All Jobs India</p>
          <p className="mt-2 max-w-xl text-sm leading-6">An independent job-information platform. We are not affiliated with any government body or employer. Always verify details on the official recruitment website or notification.</p>
        </div>
        <nav className="flex max-w-md flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
          <Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy-policy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/disclaimer">Disclaimer</Link>
        </nav>
      </div>
    </footer>
  );
}
