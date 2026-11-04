import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.FOODIE_API_ORIGIN ?? "http://localhost:8080"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
