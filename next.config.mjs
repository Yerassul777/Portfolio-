/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is only needed for the Docker image. Enabling it
  // unconditionally breaks `next build` on Windows, where tracing the
  // standalone bundle needs symlink privileges the team does not have.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
