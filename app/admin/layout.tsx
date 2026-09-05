import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full bg-blue-900 p-4 text-white sm:p-5 lg:w-64 lg:shrink-0 lg:p-6">
        <h1 className="mb-4 text-xl font-bold lg:mb-8 lg:text-2xl">
          Admin Panel
        </h1>

        <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm lg:block lg:space-y-4 lg:text-base">
          <Link href="/admin" className="block hover:text-yellow-300">
            Dashboard
          </Link>

          <Link href="/admin/jobs" className="block hover:text-yellow-300">
            Manage Jobs
          </Link>

          <Link href="/admin/new-job" className="block hover:text-yellow-300">
            Add New Job
          </Link>

          <Link href="/admin/automation" className="block hover:text-yellow-300">
            Automation
          </Link>

          <Link href="/admin/launch" className="block hover:text-yellow-300">
            Launch Readiness
          </Link>

          <Link href="/admin/review" className="block hover:text-yellow-300">
            Manual Review
          </Link>

          <Link href="/admin/sources" className="block hover:text-yellow-300">
            Sources
          </Link>

          <Link href="/admin/analytics" className="block hover:text-yellow-300">
            Analytics
          </Link>

          <Link href="/admin/job-tools" className="block hover:text-yellow-300">
            Job Tools
          </Link>

          <Link href="/admin/backup" className="block hover:text-yellow-300">
            Backup
          </Link>
        </nav>
      </aside>

      <main className="min-w-0 flex-1 bg-gray-100 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
