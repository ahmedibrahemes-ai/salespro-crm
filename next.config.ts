import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    '.space-z.ai',
    '21.0.16.62',
    '21.0.16.8',
    '127.0.0.1',
    'localhost',
    '0.0.0.0',
    'preview-chat-5183ffd3-3923-40b9-b46a-77cdd4193b52.space-z.ai',
  ],
};

export default nextConfig;
