import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">

      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white p-6">

        <h1 className="text-2xl font-bold mb-8">
          Admin Panel
        </h1>

        <nav className="space-y-4">

          <Link href="/admin" className="block hover:text-yellow-300">
            Dashboard
          </Link>

          <Link href="/admin/jobs" className="block hover:text-yellow-300">
            Manage Jobs
          </Link>

          <Link href="/admin/new-job" className="block hover:text-yellow-300">
            Add New Job
          </Link>

        </nav>

      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        {children}
      </main>

    </div>
  );
}