import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: ['@jobpilot/types'],
  // Backdrop photo is served at q90; Next 16 requires listing non-default qualities.
  images: { qualities: [75, 90] },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
