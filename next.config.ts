import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Escudos/bandeiras servidos pela Football-Data.org
      { protocol: "https", hostname: "crests.football-data.org" },
    ],
  },
};

export default nextConfig;
