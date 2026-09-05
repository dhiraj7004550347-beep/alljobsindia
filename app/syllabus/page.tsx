import type { Metadata } from "next";
import ResourcePlaceholder from "@/components/ResourcePlaceholder";
export const metadata: Metadata = { title: "Exam Syllabus", description: "Verified official examination syllabus resources when available.", robots: { index: false, follow: false } };
export default function Page() { return <ResourcePlaceholder title="Exam Syllabus" description="Official syllabus resources will appear here only after their source and version have been verified." />; }
