import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // méthode simple
    domains: ["images.unsplash.com"],

    // ou, en alternative plus fine :
    // remotePatterns: [
    //   {
    //     protocol: "https",
    //     hostname: "images.unsplash.com",
    //     pathname: "/**",
    //   },
    // ],
  },
};

export default nextConfig;
