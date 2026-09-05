import type { Metadata } from "next";
import "./globals.css";
import { SITE_CONFIG } from "@/lib/site-config";
import OptionalScripts from "@/components/OptionalScripts";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),

  title: {
    default: "All Jobs India | Latest Government & Private Jobs",
    template: "%s | All Jobs India",
  },

  description:
    "Find the latest Government and Private Jobs in India. Check vacancies, qualification, salary, age limit, last date and application details.",

  keywords: [
    "government jobs",
    "government jobs 2026",
    "private jobs",
    "latest jobs",
    "India jobs",
    "sarkari job",
    "job vacancy",
    "All Jobs India",
  ],

  authors: [
    {
      name: "All Jobs India",
    },
  ],

  creator: "All Jobs India",

  openGraph: {
    type: "website",
    siteName: "All Jobs India",
    title:
      "All Jobs India | Latest Government & Private Jobs",
    description:
      "Latest Government and Private Job Updates in India.",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">

      <body className="bg-gray-100 text-gray-900">
        <OptionalScripts />
        {children}

      </body>

    </html>
  );
}
