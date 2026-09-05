"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

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
    <main style={styles.page}>
      {/* NAVBAR */}
      <header style={styles.nav}>
        <Link href="/" style={styles.brand}>
          <span style={styles.flag}>🇮🇳</span>

          <span>
            <b style={styles.brandName}>All Jobs India</b>
            <small style={styles.brandTag}>
              Find Your Next Opportunity
            </small>
          </span>
        </Link>

        <nav style={styles.navLinks}>
          <Link href="/" style={styles.activeLink}>
            ⌂ Home
          </Link>

          <Link href="/government-jobs" style={styles.navLink}>
            🏛 Government Jobs
          </Link>

          <Link href="/private-jobs" style={styles.navLink}>
            💼 Private Jobs
          </Link>

          <Link href="/results" style={styles.navLink}>
            🏆 Results
          </Link>

          <Link href="/admit-card" style={styles.navLink}>
            ▣ Admit Card
          </Link>

          <Link href="/answer-key" style={styles.navLink}>
            ▤ Answer Key
          </Link>

          <Link href="/syllabus" style={styles.navLink}>
            ▥ Syllabus
          </Link>
        </nav>

        <Link href="/admin/login" style={styles.login}>
          👤 Login
        </Link>
      </header>

      {/* HERO */}
      <section style={styles.hero}>
        <div style={styles.heroLeft}>
          <div style={styles.pill}>
            🔥 INDIA&apos;S JOB & EXAM UPDATE HUB
          </div>

          <h1 style={styles.h1}>
            Find your next job.
            <br />
            <span>Apply with confidence.</span>
          </h1>

          <div style={styles.goldLine} />

          <p style={styles.description}>
            Government jobs, private vacancies, results, admit
            cards, answer keys and admission updates — organised in
            one clean job portal.
          </p>

          {/* SEARCH */}
          <div style={styles.searchBox}>
            <span>🔎</span>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, companies, qualification..."
              style={styles.searchInput}
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                style={styles.clearButton}
              >
                ✕
              </button>
            )}

            <Link href="/jobs" style={styles.searchButton}>
              Search
            </Link>
          </div>

          <div style={styles.buttons}>
            <a
              href="/government-jobs"
              style={styles.primaryButton}
            >
              🏛 Browse Government Jobs →
            </a>

            <a
              href="/private-jobs"
              style={styles.secondaryButton}
            >
              💼 Explore Private Jobs →
            </a>
          </div>

          {/* METRICS */}
          <div style={styles.metrics}>
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
        <div style={styles.dashboard}>
          <div style={styles.dashboardHeader}>
            <div>
              <h2 style={styles.dashboardTitle}>
                💼 Job Finder Dashboard
              </h2>

              <p style={styles.dashboardText}>
                Everything important at a glance.
              </p>
            </div>

            <span style={styles.live}>
              ● LIVE
            </span>
          </div>

          <div style={styles.stats}>
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

          <div style={styles.closing}>
            <div>
              <b>📅 Closing in next 7 days</b>

              <small>
                Don&apos;t miss the last date.
              </small>
            </div>

            <strong>{closingSoon.length}</strong>
          </div>

          <Link href="/jobs" style={styles.dashboardButton}>
            🔎 Start searching jobs →
          </Link>
        </div>
      </section>

      {/* QUICK LINKS */}
      <section style={styles.quickLinks}>
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
      <section style={styles.featureSection}>
        <div style={styles.featureHeader}>
          <div>
            <h2 style={styles.featureTitle}>
              🏆 Featured Jobs
            </h2>

            <p style={styles.featureSubtitle}>
              Latest opportunities from our database
            </p>
          </div>

          <Link href="/jobs" style={styles.viewAll}>
            View All →
          </Link>
        </div>

        {loading ? (
          <div style={styles.empty}>
            Loading jobs...
          </div>
        ) : displayJobs.length === 0 ? (
          <div style={styles.empty}>
            No jobs found.
          </div>
        ) : (
          <div style={styles.jobGrid}>
            {displayJobs.map((job, index) => (
              <a
                href={
                  job.id
                    ? `/jobs/${job.id}`
                    : "/jobs"
                }
                key={job.id ?? index}
                style={styles.jobCard}
              >
                <span style={styles.jobLogo}>
                  {index === 0
                    ? "JOB"
                    : index === 1
                    ? "GOV"
                    : "SSC"}
                </span>

                <span style={styles.jobInfo}>
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

                <span style={styles.jobCategory}>
                  {job.category || "Government Jobs"}
                </span>

                <span style={styles.arrow}>
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
    <div style={styles.metric}>
      <span style={styles.metricIcon}>{icon}</span>

      <div>
        <b style={styles.metricNumber}>
          {number}
        </b>

        <small style={styles.metricLabel}>
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
      style={{
        ...styles.stat,
        background,
      }}
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
    <a href={href} style={styles.quick}>
      <span>{icon}</span>

      <b>{title}</b>

      {subtitle && <small>{subtitle}</small>}
    </a>
  );
}

/* STYLES */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    fontFamily:
      "Arial, Helvetica, sans-serif",
    color: "#07133d",
    background:
      "linear-gradient(135deg,#f7fbff,#ffffff 50%,#edf4ff)",
  },

  nav: {
    minHeight: 82,
    display: "flex",
    alignItems: "center",
    gap: 18,
    padding: "0 38px",
    background: "#ffffff",
    borderBottom: "1px solid #dce6f6",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    textDecoration: "none",
    color: "#09215f",
    minWidth: 260,
  },

  flag: {
    fontSize: 38,
  },

  brandName: {
    display: "block",
    fontSize: 24,
    fontWeight: 900,
  },

  brandTag: {
    display: "block",
    fontSize: 11,
    color: "#687895",
    marginTop: 3,
  },

  navLinks: {
    display: "flex",
    gap: 4,
    flex: 1,
    justifyContent: "center",
  },

  navLink: {
    padding: "11px 9px",
    borderRadius: 10,
    textDecoration: "none",
    color: "#101d42",
    fontWeight: 800,
    fontSize: 12,
    whiteSpace: "nowrap",
  },

  activeLink: {
    padding: "11px 12px",
    borderRadius: 10,
    textDecoration: "none",
    background: "#1554e8",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 12,
  },

  login: {
    background: "#1554e8",
    color: "#ffffff",
    padding: "12px 16px",
    borderRadius: 11,
    textDecoration: "none",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  hero: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0,1.05fr) minmax(380px,.95fr)",
    gap: 45,
    padding: "48px 65px 20px",
    maxWidth: 1550,
    margin: "auto",
  },

  heroLeft: {
    minWidth: 0,
  },

  pill: {
    display: "inline-block",
    border: "1.5px solid #78a7ff",
    borderRadius: 30,
    padding: "8px 15px",
    color: "#1554e8",
    fontWeight: 900,
    letterSpacing: 1,
    fontSize: 12,
  },

  h1: {
    fontSize:
      "clamp(48px,5.2vw,76px)",
    lineHeight: 0.98,
    letterSpacing: -3,
    margin: "18px 0 0",
    fontWeight: 950,
  },

  goldLine: {
    width: 390,
    maxWidth: "80%",
    height: 6,
    background: "#f2a900",
    borderRadius: 8,
    margin: "15px 0 17px",
  },

  description: {
    maxWidth: 780,
    fontSize: 17,
    lineHeight: 1.55,
    color: "#23395e",
  },

  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    maxWidth: 760,
    background: "#ffffff",
    border: "1px solid #cbd9ef",
    borderRadius: 15,
    padding: 7,
    marginTop: 22,
    boxShadow:
      "0 8px 25px rgba(30,70,140,.08)",
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    fontSize: 15,
    padding: "11px 5px",
    color: "#101d42",
  },

  clearButton: {
    border: "none",
    background: "#edf2fa",
    borderRadius: 8,
    cursor: "pointer",
    padding: "7px 9px",
  },

  searchButton: {
    background: "#06102f",
    color: "#ffffff",
    textDecoration: "none",
    padding: "11px 18px",
    borderRadius: 10,
    fontWeight: 900,
  },

  buttons: {
    display: "flex",
    gap: 14,
    marginTop: 20,
    flexWrap: "wrap",
  },

  primaryButton: {
    background: "#1554e8",
    color: "#ffffff",
    padding: "15px 20px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 900,
  },

  secondaryButton: {
    background: "#ffffff",
    color: "#0a1944",
    padding: "15px 20px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 900,
    border: "1.5px solid #6d9bff",
  },

  metrics: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",
    marginTop: 28,
  },

  metric: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    borderRight: "1px solid #b9c4d8",
    padding: 8,
  },

  metricIcon: {
    fontSize: 22,
  },

  metricNumber: {
    display: "block",
    fontSize: 16,
  },

  metricLabel: {
    display: "block",
    fontSize: 10,
    color: "#52627e",
    marginTop: 3,
  },

  dashboard: {
    background: "#ffffff",
    border: "1px solid #c9dcff",
    borderRadius: 28,
    padding: 28,
    boxShadow:
      "0 16px 45px rgba(40,90,180,.08)",
    alignSelf: "start",
  },

  dashboardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
  },

  dashboardTitle: {
    margin: 0,
    fontSize: 22,
  },

  dashboardText: {
    margin: "7px 0 0",
    color: "#657491",
  },

  live: {
    color: "#16a35a",
    fontWeight: 900,
    fontSize: 11,
  },

  stats: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3,1fr)",
    gap: 12,
    marginTop: 20,
  },

  stat: {
    borderRadius: 18,
    padding: 15,
    minHeight: 78,
  },

  closing: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 17,
    padding: 15,
    borderRadius: 18,
    background: "#ffe8ec",
    color: "#d92743",
  },

  dashboardButton: {
    display: "block",
    marginTop: 17,
    padding: 16,
    borderRadius: 17,
    background: "#06102f",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
  },

  quickLinks: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 17,
    padding: "8px 65px 25px",
    maxWidth: 1550,
    margin: "auto",
  },

  quick: {
    width: 105,
    minHeight: 80,
    borderRadius: 17,
    background: "#eef4ff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    color: "#153a9b",
    gap: 3,
  },

  featureSection: {
    background: "#eff6ff",
    padding: "25px 65px 35px",
  },

  featureHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: 1450,
    margin: "auto",
  },

  featureTitle: {
    margin: 0,
    fontSize: 28,
  },

  featureSubtitle: {
    margin: "5px 0 0",
    color: "#657491",
  },

  viewAll: {
    color: "#1554e8",
    fontWeight: 900,
    textDecoration: "none",
  },

  jobGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",
    gap: 16,
    maxWidth: 1450,
    margin: "18px auto",
  },

  jobCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 17,
    background: "#ffffff",
    border: "1px solid #d5e1f6",
    borderRadius: 17,
    textDecoration: "none",
    color: "#0a1944",
  },

  jobLogo: {
    width: 63,
    height: 48,
    borderRadius: 11,
    background: "#f1f5ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    color: "#1554e8",
    flexShrink: 0,
  },

  jobInfo: {
    flex: 1,
    minWidth: 0,
  },

  jobCategory: {
    fontSize: 10,
    color: "#1554e8",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  arrow: {
    fontSize: 20,
    fontWeight: 900,
  },

  empty: {
    maxWidth: 1450,
    margin: "20px auto",
    padding: 35,
    textAlign: "center",
    background: "#ffffff",
    borderRadius: 18,
    color: "#657491",
  },

  news: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    maxWidth: 1450,
    margin: "17px auto 0",
    padding: 13,
    background: "#dff8e9",
    borderRadius: 25,
    color: "#174b2e",
    fontSize: 13,
    flexWrap: "wrap",
  },
};
