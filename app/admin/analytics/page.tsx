"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AnalyticsData = {
  totalJobs?: number;
  governmentJobs?: number;
  privateJobs?: number;
  activeJobs?: number;
  closingSoon?: number;
  expiredJobs?: number;
  featuredJobs?: number;
};

const EMPTY_DATA: AnalyticsData = {
  totalJobs: 0,
  governmentJobs: 0,
  privateJobs: 0,
  activeJobs: 0,
  closingSoon: 0,
  expiredJobs: 0,
  featuredJobs: 0,
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAnalytics() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/jobs/stats", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();

        /*
         * Support both:
         *
         * {
         *   totalJobs: ...
         * }
         *
         * and:
         *
         * {
         *   stats: {
         *     totalJobs: ...
         *   }
         * }
         */
        const source =
          json?.stats && typeof json.stats === "object"
            ? json.stats
            : json;

        const normalized: AnalyticsData = {
          totalJobs: Number(
            source?.totalJobs ??
            source?.total ??
            source?.totalJob ??
            0
          ),

          governmentJobs: Number(
            source?.governmentJobs ??
            source?.government ??
            source?.governmentCount ??
            0
          ),

          privateJobs: Number(
            source?.privateJobs ??
            source?.private ??
            source?.privateCount ??
            0
          ),

          activeJobs: Number(
            source?.activeJobs ??
            source?.active ??
            source?.activeCount ??
            0
          ),

          closingSoon: Number(
            source?.closingSoon ??
            source?.closingSoonJobs ??
            0
          ),

          expiredJobs: Number(
            source?.expiredJobs ??
            source?.expired ??
            source?.expiredCount ??
            0
          ),

          featuredJobs: Number(
            source?.featuredJobs ??
            source?.featured ??
            source?.featuredCount ??
            0
          ),
        };

        if (mounted) {
          setData(normalized);
        }
      } catch (err) {
        console.error("Analytics loading error:", err);

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load analytics"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        <div className="mb-6">
          <a
            href="/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Admin Dashboard
          </a>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Job Analytics
          </h1>

          <p className="mt-1 text-slate-600">
            Overview of jobs, categories and application status.
          </p>
        </div>

        {loading && (
          <div className="rounded-xl border bg-white p-8 shadow-sm">
            <p className="text-slate-600">
              Loading analytics...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-semibold text-red-700">
              Analytics could not be loaded
            </h2>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

              <StatCard
                title="Total Jobs"
                value={data.totalJobs ?? 0}
                icon="📋"
              />

              <StatCard
                title="Government Jobs"
                value={data.governmentJobs ?? 0}
                icon="🏛️"
              />

              <StatCard
                title="Private Jobs"
                value={data.privateJobs ?? 0}
                icon="💼"
              />

              <StatCard
                title="Featured Jobs"
                value={data.featuredJobs ?? 0}
                icon="⭐"
              />

            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              <StatusCard
                title="Active Jobs"
                value={data.activeJobs ?? 0}
                description="Currently active vacancies"
                icon="🟢"
              />

              <StatusCard
                title="Closing Soon"
                value={data.closingSoon ?? 0}
                description="Jobs nearing their last date"
                icon="⏳"
              />

              <StatusCard
                title="Expired Jobs"
                value={data.expiredJobs ?? 0}
                description="Jobs whose last date has passed"
                icon="🔴"
              />

            </div>

            <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">

              <h2 className="text-xl font-bold text-slate-900">
                Job Distribution
              </h2>

              <div className="mt-5 space-y-4">

                <DistributionRow
                  label="Government Jobs"
                  value={data.governmentJobs ?? 0}
                  total={data.totalJobs ?? 0}
                />

                <DistributionRow
                  label="Private Jobs"
                  value={data.privateJobs ?? 0}
                  total={data.totalJobs ?? 0}
                />

                <DistributionRow
                  label="Featured Jobs"
                  value={data.featuredJobs ?? 0}
                  total={data.totalJobs ?? 0}
                />

              </div>

            </div>

            <div className="mt-6 flex flex-wrap gap-3">

              <Link
                href="/admin/jobs"
                className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
              >
                Manage Jobs
              </Link>

              <Link
                href="/admin/new-job"
                className="rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-700"
              >
                Add New Job
              </Link>

              <a
                href="/admin/job-tools"
                className="rounded-lg bg-slate-800 px-5 py-3 font-medium text-white hover:bg-slate-900"
              >
                Job Tools
              </a>

            </div>
          </>
        )}

      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>

        <span className="text-3xl font-bold text-slate-900">
          {value}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-slate-600">
        {title}
      </p>
    </div>
  );
}

function StatusCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>

        <h2 className="font-semibold text-slate-900">
          {title}
        </h2>
      </div>

      <p className="mt-4 text-3xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function DistributionRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage =
    total > 0
      ? Math.min(100, Math.round((value / total) * 100))
      : 0;

  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-medium text-slate-700">
          {label}
        </span>

        <span className="text-slate-500">
          {value} ({percentage}%)
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
