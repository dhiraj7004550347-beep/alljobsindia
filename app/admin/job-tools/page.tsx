"use client"

import { useEffect, useMemo, useState } from "react"

type Job = {
    id: number
    title: string
    department: string
    category: string
    vacancy: string
    location: string
    lastDate: string
    status?: string
    featured?: boolean
}

function getStatus(job: Job) {

    if (!job.lastDate) {
        return "Active"
    }

    const now = new Date()
    const end = new Date(job.lastDate)

    if (end.getTime() < now.getTime()) {
        return "Expired"
    }

    const diff =
        end.getTime() - now.getTime()

    const days =
        Math.ceil(
            diff / (1000 * 60 * 60 * 24)
        )

    if (days <= 7) {
        return "Closing Soon"
    }

    if (job.status === "DRAFT") {
        return "Draft"
    }

    return "Active"
}

export default function JobToolsPage() {

    const [jobs, setJobs] = useState<Job[]>([])
    const [search, setSearch] = useState("")
    const [category, setCategory] = useState("ALL")
    const [status, setStatus] = useState("ALL")
    const [loading, setLoading] = useState(true)

    useEffect(() => {

        fetch("/api/jobs")
            .then(res => res.json())
            .then(data => {

                const list =
                    Array.isArray(data)
                        ? data
                        : data.jobs || []

                setJobs(list)

            })
            .catch(() => {
                setJobs([])
            })
            .finally(() => {
                setLoading(false)
            })

    }, [])

    const categories =
        useMemo(() => {

            return [
                "ALL",
                ...Array.from(
                    new Set(
                        jobs
                            .map(j => j.category)
                            .filter(Boolean)
                    )
                )
            ]

        }, [jobs])

    const filtered =
        jobs.filter(job => {

            const q =
                search.trim().toLowerCase()

            const matchesSearch =
                !q ||
                [
                    job.title,
                    job.department,
                    job.category,
                    job.location
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(q)

            const matchesCategory =
                category === "ALL" ||
                job.category === category

            const currentStatus =
                getStatus(job)

            const matchesStatus =
                status === "ALL" ||
                currentStatus === status

            return (
                matchesSearch &&
                matchesCategory &&
                matchesStatus
            )
        })

    const total = jobs.length

    const government =
        jobs.filter(
            j =>
                j.category
                    ?.toLowerCase()
                    .includes("government")
        ).length

    const privateJobs =
        jobs.filter(
            j =>
                j.category
                    ?.toLowerCase()
                    .includes("private")
        ).length

    const closingSoon =
        jobs.filter(
            j => getStatus(j) === "Closing Soon"
        ).length

    const expired =
        jobs.filter(
            j => getStatus(j) === "Expired"
        ).length

    return (
        <main className="mx-auto max-w-7xl px-6 py-10">

            <div className="mb-8">

                <h1 className="text-3xl font-bold">
                    Job Management Tools
                </h1>

                <p className="mt-2 text-gray-600">
                    Search, filter and monitor all job vacancies.
                </p>

            </div>

            <div className="grid gap-4 md:grid-cols-5 mb-8">

                <div className="rounded-xl border p-5">
                    <p className="text-sm text-gray-500">
                        Total Jobs
                    </p>
                    <p className="text-3xl font-bold">
                        {total}
                    </p>
                </div>

                <div className="rounded-xl border p-5">
                    <p className="text-sm text-gray-500">
                        Government
                    </p>
                    <p className="text-3xl font-bold">
                        {government}
                    </p>
                </div>

                <div className="rounded-xl border p-5">
                    <p className="text-sm text-gray-500">
                        Private
                    </p>
                    <p className="text-3xl font-bold">
                        {privateJobs}
                    </p>
                </div>

                <div className="rounded-xl border p-5">
                    <p className="text-sm text-gray-500">
                        Closing Soon
                    </p>
                    <p className="text-3xl font-bold">
                        {closingSoon}
                    </p>
                </div>

                <div className="rounded-xl border p-5">
                    <p className="text-sm text-gray-500">
                        Expired
                    </p>
                    <p className="text-3xl font-bold">
                        {expired}
                    </p>
                </div>

            </div>

            <div className="rounded-xl border p-5 mb-8">

                <div className="grid gap-4 md:grid-cols-3">

                    <input
                        value={search}
                        onChange={e =>
                            setSearch(e.target.value)
                        }
                        placeholder="Search jobs..."
                        className="rounded-lg border px-4 py-3"
                    />

                    <select
                        value={category}
                        onChange={e =>
                            setCategory(e.target.value)
                        }
                        className="rounded-lg border px-4 py-3"
                    >

                        {categories.map(c => (
                            <option
                                key={c}
                                value={c}
                            >
                                {c === "ALL"
                                    ? "All Categories"
                                    : c}
                            </option>
                        ))}

                    </select>

                    <select
                        value={status}
                        onChange={e =>
                            setStatus(e.target.value)
                        }
                        className="rounded-lg border px-4 py-3"
                    >

                        <option value="ALL">
                            All Status
                        </option>

                        <option value="Active">
                            Active
                        </option>

                        <option value="Closing Soon">
                            Closing Soon
                        </option>

                        <option value="Expired">
                            Expired
                        </option>

                        <option value="Draft">
                            Draft
                        </option>

                    </select>

                </div>

            </div>

            <div className="rounded-xl border overflow-hidden">

                <div className="overflow-x-auto">

                    <table className="w-full text-sm">

                        <thead className="bg-gray-50">

                            <tr>

                                <th className="p-4 text-left">
                                    #
                                </th>

                                <th className="p-4 text-left">
                                    Job
                                </th>

                                <th className="p-4 text-left">
                                    Category
                                </th>

                                <th className="p-4 text-left">
                                    Vacancy
                                </th>

                                <th className="p-4 text-left">
                                    Location
                                </th>

                                <th className="p-4 text-left">
                                    Last Date
                                </th>

                                <th className="p-4 text-left">
                                    Status
                                </th>

                                <th className="p-4 text-left">
                                    Action
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                            {loading && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="p-8 text-center"
                                    >
                                        Loading jobs...
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                filtered.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="p-8 text-center"
                                        >
                                            No jobs found.
                                        </td>
                                    </tr>
                                )}

                            {!loading &&
                                filtered.map(job => {

                                    const currentStatus =
                                        getStatus(job)

                                    return (
                                        <tr
                                            key={job.id}
                                            className="border-t"
                                        >

                                            <td className="p-4">
                                                {job.id}
                                            </td>

                                            <td className="p-4">

                                                <div className="font-semibold">
                                                    {job.title}
                                                </div>

                                                <div className="text-xs text-gray-500">
                                                    {job.department}
                                                </div>

                                            </td>

                                            <td className="p-4">
                                                {job.category}
                                            </td>

                                            <td className="p-4">
                                                {job.vacancy}
                                            </td>

                                            <td className="p-4">
                                                {job.location}
                                            </td>

                                            <td className="p-4">
                                                {job.lastDate
                                                    ? new Date(
                                                        job.lastDate
                                                    ).toLocaleDateString(
                                                        "en-IN"
                                                    )
                                                    : "-"}
                                            </td>

                                            <td className="p-4">

                                                <span className="rounded-full border px-3 py-1 text-xs">
                                                    {currentStatus}
                                                </span>

                                            </td>

                                            <td className="p-4">

                                                <div className="flex gap-3">

                                                    <a
                                                        href={`/admin/jobs/${job.id}`}
                                                        className="underline"
                                                    >
                                                        View
                                                    </a>

                                                    <a
                                                        href={`/admin/jobs/${job.id}/edit`}
                                                        className="underline"
                                                    >
                                                        Edit
                                                    </a>

                                                </div>

                                            </td>

                                        </tr>
                                    )
                                })}

                        </tbody>

                    </table>

                </div>

            </div>

        </main>
    )
}
