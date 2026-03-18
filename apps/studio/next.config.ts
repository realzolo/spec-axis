import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@spec-axis/contracts'],
};

export default nextConfig;
