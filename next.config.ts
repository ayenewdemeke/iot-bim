import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.20.10.2'], // Allow Raspberry Pi IP
};

export default nextConfig;
