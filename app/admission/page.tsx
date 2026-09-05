import type { Metadata } from "next";
import ResourcePlaceholder from "@/components/ResourcePlaceholder";
export const metadata: Metadata = { title: "Admissions", description: "Verified official admission notices when available.", robots: { index: false, follow: false } };
export default function Page() { return <ResourcePlaceholder title="Admissions" description="Verified official admission notices will appear here when a dedicated source workflow is available." />; }
