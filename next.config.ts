import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '192.168.0.10',
    '192.168.0.*',
    '192.168.*.*',
    'localhost',
    '127.0.0.1',
    '100.68.*.*',
  ],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    qualities: [75, 80, 85],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'mwvbjdifhphfpvrnqqhs.supabase.co',
      },
    ],
  },
};

export default nextConfig;
