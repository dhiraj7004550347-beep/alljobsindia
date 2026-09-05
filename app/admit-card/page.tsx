import type { Metadata } from "next";
import ResourcePlaceholder from "@/components/ResourcePlaceholder";
export const metadata: Metadata = { title: "Admit Cards", description: "Verified admit-card updates when available.", robots: { index: false, follow: false } };
export default function Page() { return <ResourcePlaceholder title="Admit Cards" description="Verified hall-ticket and city-intimation notices will appear here when a dedicated official-source workflow is available." />; }
