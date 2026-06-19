import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* ─── Build optimizations (reduces Vercel CPU usage) ─── */
  // Standalone output: smaller deployment, faster cold starts, less build CPU
  output: 'standalone',
  // Production: strict mode catches bugs early (off in dev for perf)
  reactStrictMode: false,
  // Compress responses server-side (less bandwidth = less CPU)
  compress: true,
  // Powering off the X-Powered-By header (tiny perf win + security)
  poweredByHeader: false,
  // Generate route manifests for better caching on Vercel edge
  generateEtags: true,

  /* ─── Compiler optimizations ─── */
  compiler: {
    // Remove console.log in production (keeps console.error/warn)
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },

  /* ─── Experimental: reduce bundle size ─── */
  experimental: {
    // Tree-shake unused CSS more aggressively
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      '@radix-ui/react-dropdown-menu',
    ],
  },

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
