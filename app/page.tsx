"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import styles from "./home.module.css";

type Job = {
  id?: string | number;
  title?: string;
  company?: string;
  organization?: string;
  category?: string;
  department?: string;
  qualification?: string;
  location?: string;
  vacancy?: string | number;
  lastDate?: string;
  featured?: boolean;
};

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : data.jobs || data.data || [];

        setJobs(list);
      })
      .catch((error) => {
        console.error("JOB LOAD ERROR:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const governmentJobs = jobs.filter((job) =>
    String(job.category || "")
      .toLowerCase()
      .includes("government")
  );

  const privateJobs = jobs.filter((job) =>
    String(job.category || "")
      .toLowerCase()
      .includes("private")
  );

  const closingSoon = jobs.filter((job) => {
    if (!job.lastDate) return false;

    const today = new Date();
    const deadline = new Date(job.lastDate);

    const diff =
      (deadline.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24);

    return diff >= 0 && diff <= 7;
  });

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return jobs;

    return jobs.filter((job) =>
      [
        job.title,
        job.company,
        job.organization,
        job.category,
        job.department,
        job.qualification,
        job.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [jobs, search]);

  const featuredJobs = filteredJobs
    .filter((job) => job.featured)
    .slice(0, 3);

  const displayJobs =
    featuredJobs.length > 0
      ? featuredJobs
      : filteredJobs.slice(0, 3);

  return (
    <main className={styles.page}>
      {/* NAVBAR */}
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}>
          <span className={styles.flag}>🇮🇳</span>

          <span>
            <b className={styles.brandName}>All Jobs India</b>
            <small className={styles.brandTag}>
              Find Your Next Opportunity
            </small>
          </span>
        </Link>

        <nav className={styles.navLinks} aria-label="Main navigation">
          <Link href="/" className={styles.activeLink}>
            ⌂ Home
          </Link>

          <Link href="/government-jobs" className={styles.navLink}>
            🏛 Government Jobs
          </Link>

          <Link href="/private-jobs" className={styles.navLink}>
            💼 Private Jobs
          </Link>

          <Link href="/results" className={styles.navLink}>
            🏆 Results
          </Link>

          <Link href="/admit-card" className={styles.navLink}>
            ▣ Admit Card
          </Link>

          <Link href="/answer-key" className={styles.navLink}>
            ▤ Answer Key
          </Link>

          <Link href="/syllabus" className={styles.navLink}>
            ▥ Syllabus
          </Link>
        </nav>

        <Link href="/admin/login" className={styles.login}>
          👤 Login
        </Link>
      </header>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.pill}>
            🔥 INDIA&apos;S JOB & EXAM UPDATE HUB
          </div>

          <h1 className={styles.h1}>
            Find your next job.
            <br />
            <span>Apply with confidence.</span>
          </h1>

          <div className={styles.goldLine} />

          <p className={styles.description}>
            Government jobs, private vacancies, results, admit
            cards, answer keys and admission updates — organised in
            one clean job portal.
          </p>

          {/* SEARCH */}
          <div className={styles.searchBox}>
            <span>🔎</span>

            <input
              aria-label="Search jobs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, companies, qualification..."
              className={styles.searchInput}
            />

            {search && (
              <button
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className={styles.clearButton}
              >
                ✕
              </button>
            )}

            <Link href="/jobs" className={styles.searchButton}>
              Search
            </Link>
          </div>

          <div className={styles.buttons}>
            <a
              href="/government-jobs"
              className={styles.primaryButton}
            >
              🏛 Browse Government Jobs →
            </a>

            <a
              href="/private-jobs"
              className={styles.secondaryButton}
            >
              💼 Explore Private Jobs →
            </a>
          </div>

          {/* METRICS */}
          <div className={styles.metrics}>
            <Metric
              icon="🏛"
              number={String(governmentJobs.length)}
              label="Government Jobs"
            />

            <Metric
              icon="💼"
              number={String(privateJobs.length)}
              label="Private Jobs"
            />

            <Metric
              icon="👥"
              number={String(jobs.length)}
              label="Live Listings"
            />

            <Metric
              icon="⚡"
              number={String(closingSoon.length)}
              label="Closing Soon"
            />
          </div>
        </div>

        {/* DASHBOARD */}
        <div className={styles.dashboard}>
          <div className={styles.dashboardHeader}>
            <div>
              <h2 className={styles.dashboardTitle}>
                💼 Job Finder Dashboard
              </h2>

              <p className={styles.dashboardText}>
                Everything important at a glance.
              </p>
            </div>

            <span className={styles.live}>
              ● LIVE
            </span>
          </div>

          <div className={styles.stats}>
            <Stat
              title="Total Jobs"
              value={jobs.length}
              background="#eaf2ff"
            />

            <Stat
              title="Government"
              value={governmentJobs.length}
              background="#e7faef"
            />

            <Stat
              title="Private"
              value={privateJobs.length}
              background="#f0eaff"
            />
          </div>

          <div className={styles.closing}>
            <div>
              <b>📅 Closing in next 7 days</b>

              <small>
                Don&apos;t miss the last date.
              </small>
            </div>

            <strong>{closingSoon.length}</strong>
          </div>

          <Link href="/jobs" className={styles.dashboardButton}>
            🔎 Start searching jobs →
          </Link>
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className={styles.quickLinks}>
        <Quick
          icon="🔔"
          title="Latest"
          subtitle="Updates"
          href="/results"
        />

        <Quick
          icon="▣"
          title="Admit"
          subtitle="Card"
          href="/admit-card"
        />

        <Quick
          icon="⌕"
          title="Answer"
          subtitle="Key"
          href="/answer-key"
        />

        <Quick
          icon="▥"
          title="Syllabus"
          subtitle=""
          href="/syllabus"
        />
      </section>

      {/* FEATURED JOBS */}
      <section className={styles.featureSection}>
        <div className={styles.featureHeader}>
          <div>
            <h2 className={styles.featureTitle}>
              🏆 Featured Jobs
            </h2>

            <p className={styles.featureSubtitle}>
              Latest opportunities from our database
            </p>
          </div>

          <Link href="/jobs" className={styles.viewAll}>
            View All →
          </Link>
        </div>

        {loading ? (
          <div className={styles.empty}>
            Loading jobs...
          </div>
        ) : displayJobs.length === 0 ? (
          <div className={styles.empty}>
            No jobs found.
          </div>
        ) : (
          <div className={styles.jobGrid}>
            {displayJobs.map((job, index) => (
              <a
                href={
                  job.id
                    ? `/jobs/${job.id}`
                    : "/jobs"
                }
                key={job.id ?? index}
                className={styles.jobCard}
              >
                <span className={styles.jobLogo}>
                  {index === 0
                    ? "JOB"
                    : index === 1
                    ? "GOV"
                    : "SSC"}
                </span>

                <span className={styles.jobInfo}>
                  <b>
                    {job.company || job.organization || job.department || "Not specified"}
                  </b>

                  <strong>
                    {job.title}
                  </strong>

                  <small>
                    {job.location || "Not specified"}
                  </small>
                </span>

                <span className={styles.jobCategory}>
                  {job.category || "Government Jobs"}
                </span>

                <span className={styles.arrow}>
                  →
                </span>
              </a>
            ))}
          </div>
        )}

      </section>
      <PublicFooter />
    </main>
  );
}

/* COMPONENTS */

function Metric({
  icon,
  number,
  label,
}: {
  icon: string;
  number: string;
  label: string;
}) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricIcon}>{icon}</span>

      <div>
        <b className={styles.metricNumber}>
          {number}
        </b>

        <small className={styles.metricLabel}>
          {label}
        </small>
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  background,
}: {
  title: string;
  value: number;
  background: string;
}) {
  return (
    <div
      className={styles.stat}
      style={{ background }}
    >
      <small>{title}</small>

      <strong>{value}</strong>
    </div>
  );
}

function Quick({
  icon,
  title,
  subtitle,
  href,
}: {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <a href={href} className={styles.quick}>
      <span>{icon}</span>

      <b>{title}</b>

      {subtitle && <small>{subtitle}</small>}
    </a>
  );
}
