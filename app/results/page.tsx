import type { Metadata } from "next";
import ResourcePlaceholder from "@/components/ResourcePlaceholder";
export const metadata: Metadata = { title: "Exam Results", description: "Verified examination result updates when available.", robots: { index: false, follow: false } };
export default function Page() { return <ResourcePlaceholder title="Exam Results" description="Verified result notices will appear here when a dedicated official-source workflow is available." />; }
