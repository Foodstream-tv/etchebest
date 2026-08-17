import type { NextConfig } from "next";
import path from "node:path";

const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET || "http://localhost:8081";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), "../"),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
      {
        source: "/replays-storage/:path*",
        destination: `${API_PROXY_TARGET}/replays-storage/:path*`,
      },
    ];
  },
};

export default nextConfig;
