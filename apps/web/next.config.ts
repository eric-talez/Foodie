import type { NextConfig } from "next";
import { parseApiOrigin } from "./src/lib/apiOrigin";

const apiOrigin = parseApiOrigin(process.env.FOODIE_API_ORIGIN ?? "http://localhost:8080");
if (!apiOrigin) throw new Error("FOODIE_API_ORIGIN must be a plain HTTP(S) origin");

const nextConfig: NextConfig = {
  // The server descriptor lookup must use the same build-time origin as the rewrite.
  env: { FOODIE_BUILD_API_ORIGIN: apiOrigin },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js bootstraps the App Router with inline scripts; local HMR also uses eval.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; ");
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      ],
    }];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
