import type { NextConfig } from "next";
import { UPLOAD_BODY_BYTES } from "./lib/image-upload";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: UPLOAD_BODY_BYTES },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
