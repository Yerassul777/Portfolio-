// The session token lives in localStorage, so these headers are the cheap
// layer of defence around it. Camera stays allowed for the site itself: the
// certificate scanner will need it.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()" },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is only needed for the Docker image. Enabling it
  // unconditionally breaks `next build` on Windows, where tracing the
  // standalone bundle needs symlink privileges the team does not have.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
