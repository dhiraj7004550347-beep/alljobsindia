import type { Metadata } from "next";
import Link from "next/link";
import { getPublicJobsPage } from "../../actions/jobs";
import PublicJobSearch from "../../components/PublicJobSearch";
import PublicFooter from "../../components/PublicFooter";
import { parsePublicJobFilters } from "@/lib/public-jobs-query";

export const metadata: Metadata = {
  title: "Latest Jobs in India",
  description: "Browse active government and private job listings with official source and application links.",
};
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parsePublicJobFilters(await searchParams);
  const result = await getPublicJobsPage(filters);

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Link href="/" className="text-blue-100 hover:text-white">← Home</Link>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl">Find Jobs</h1>
          <p className="mt-3 text-lg text-blue-100">Search active Government and Private jobs across India.</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <PublicJobSearch
          jobs={result.jobs}
          filters={{ ...filters, page: result.page }}
          categories={result.categories}
          locations={result.locations}
          total={result.total}
          page={result.page}
          pageCount={result.pageCount}
        />
      </div>
      <PublicFooter />
    </main>
  );
}
