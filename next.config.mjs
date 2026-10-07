const isDev = process.env.NODE_ENV !== "production"

// Supabase is the only third party the browser talks to directly (REST, Auth
// and the Realtime websocket). vercel.live serves the toolbar on preview
// deployments only.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin
  } catch {
    return ""
  }
})()

// Scripts keep 'unsafe-inline': the App Router inlines its bootstrap scripts,
// and nonces would force every page to render dynamically. The directives that
// matter most here are connect-src (where a script may send data), frame-ancestors,
// base-uri, form-action and object-src.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  // Opportunity images are hotlinked from organisers' sites, or stored inline.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, "wss:")} https://vercel.live wss://ws-us3.pusher.com${isDev ? " ws:" : ""}`,
  "frame-src https://vercel.live",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

// The session token lives in localStorage, so these headers are the cheap
// layer of defence around it. Camera stays allowed for the site itself: the
// certificate scanner will need it.
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Other sites cannot keep a handle on our window (sign-in uses redirects, not popups).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
  experimental: {
    // A styled 404 for URLs outside /[locale], which has no single root layout.
    globalNotFound: true,
    // The stylesheet (~15 KB gzipped, Tailwind) goes into the HTML instead of
    // a separate render-blocking request. On a slow mobile link that request
    // shared bandwidth with the JavaScript and held the first paint until
    // ~2.4 s; inlined, text paints as soon as the HTML arrives.
    inlineCss: true,
  },
  // Fonts for the link-preview images are read from disk at runtime.
  outputFileTracingIncludes: {
    "/[locale]/opengraph-image": ["./assets/fonts/**"],
    "/[locale]/o/[slug]/opengraph-image": ["./assets/fonts/**"],
    "/api/portfolio/pdf": ["./assets/fonts/**"],
  },
  async redirects() {
    // Temporary (307): "/" may pick a language from the browser once there is
    // more than one. Query strings are kept, so old shared links still work.
    return [
      { source: "/", destination: "/ru", permanent: false },
      { source: "/admin", destination: "/ru/admin", permanent: false },
    ]
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must be re-checked on every visit, or an old one
      // could keep serving old pages after a deploy.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      // File names carry a content hash, so they never change in place.
      {
        source: "/images/opportunities/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ]
  },
}

export default nextConfig
