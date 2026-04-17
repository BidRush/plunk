/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ['@plunk/ui'],
  output: 'standalone', // Optimized for Docker
  allowedDevOrigins: ['plunk.bidrush.com'],
  devIndicators: false,
};
