import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/o/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "unsafe-none",
          },
        ],
      },
      {
        source: "/((?!o/).*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/:path*@:size",
        destination: "/:path*?size=:size",
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias["gaussian-splats-3d"] = path.resolve(
      __dirname,
      "GaussianSplats3D/build/gaussian-splats-3d.module.js"
    );
    return config;
  },
  swcMinify: true,
};

export default nextConfig;
