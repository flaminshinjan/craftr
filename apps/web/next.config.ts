import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is a signed-in, client-rendered workspace that talks to the Craftr api,
  // so it uses the request-time rendering model rather than Cache Components.
  transpilePackages: ["@craftr/core"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
