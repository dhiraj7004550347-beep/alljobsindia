import Link from "next/link";
import JobBackup from "../../../components/JobBackup";

export default function BackupPage() {
  return (
    <main className="min-h-screen bg-gray-100 py-10 px-4">

      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-8">

          <div>
            <h1 className="text-4xl font-bold">
              Database Backup
            </h1>

            <p className="text-gray-600 mt-2">
              Manage your All Jobs India job database backup.
            </p>
          </div>

          <Link
            href="/admin"
            className="text-blue-700 font-semibold"
          >
            ← Admin Dashboard
          </Link>

        </div>

        <JobBackup />

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mt-6">

          <h3 className="font-bold text-lg">
            ⚠ Important
          </h3>

          <p className="text-gray-700 mt-2">
            Keep your downloaded JSON backup in a safe
            location. It can be used to restore your jobs
            later.
          </p>

        </div>

      </div>

    </main>
  );
}