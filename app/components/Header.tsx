import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-blue-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">

        <Link href="/" className="text-3xl font-bold">
          AllJobsIndia
        </Link>

        <nav className="flex gap-6 text-lg">
          <Link href="/">Home</Link>
          <Link href="/jobs">Government Jobs</Link>
          <a href="#">Private Jobs</a>
          <a href="#">Results</a>
          <a href="#">Admit Card</a>
          <a href="#">Answer Key</a>
        </nav>

      </div>
    </header>
  );
}