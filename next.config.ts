import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloud Run target: emit a self-contained server bundle.
  output: 'standalone',
  reactStrictMode: true,
  typedRoutes: false,
};

export default nextConfig;
