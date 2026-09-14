import type { NextConfig } from "next";

const pdfRuntimeFiles = [
  "./node_modules/@napi-rs/canvas*/**/*",
  "./node_modules/pdfjs-dist/legacy/build/*.mjs",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/admin/sources/*/test": pdfRuntimeFiles,
    "/api/admin/sources/*/run": pdfRuntimeFiles,
    "/api/admin/review/*": pdfRuntimeFiles,
    "/api/automation/*": pdfRuntimeFiles,
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
