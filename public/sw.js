// Portfolio+ service worker: the site keeps working with a bad connection.
//
// - Pages: network first, so content is always fresh when online. Every page
//   that loads is kept, and shown from the cache when the network fails; a
//   page never visited gets /offline.html.
// - Build assets (/_next/static, hashed and immutable), icons and catalogue
//   images: cache first.
// - Everything else is left alone: Supabase and other origins, /api, and the
//   payloads Next.js fetches for in-app navigation always go to the network.
//
// - Push: deadline reminders (sent by /api/cron/reminders) are shown as
//   notifications; a tap opens the opportunity. The payload carries only
//   public catalogue data.
//
// Bump VERSION to drop every cache on the next visit.
const VERSION = "v1"
const STATIC_CACHE = `static-${VERSION}`
const PAGE_CACHE = `pages-${VERSION}`
const OFFLINE_URL = "/offline.html"
const FAVICON_URL = "/favicon.ico"
const MAX_PAGES = 30
const MAX_STATIC = 300
// Sign-in redirects carry a one-time code or token in the URL: never stored.
const AUTH_PARAMS = ["code", "access_token", "refresh_token", "token_hash", "error_description"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll([new Request(OFFLINE_URL, { cache: "reload" }), new Request(FAVICON_URL, { cache: "reload" })]))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE])
      for (const key of await caches.keys()) {
        if (!keep.has(key)) await caches.delete(key)
      }
      // Lets the browser start the page request while the worker boots.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event))
    return
  }
  if (url.pathname === FAVICON_URL) {
    event.respondWith(caches.match(FAVICON_URL).then((cached) => cached || fetch(request)))
    return
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/")
  ) {
    event.respondWith(cacheFirst(request))
  }
})

// Signing out (components/auth-provider.tsx) drops the offline copies of
// pages, so the next person on a shared device does not find them.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "purge-pages" || event.origin !== self.location.origin) return
  event.waitUntil(
    caches.open(PAGE_CACHE).then(async (cache) => {
      for (const request of await cache.keys()) {
        const path = new URL(request.url).pathname
        if (path !== OFFLINE_URL && path !== FAVICON_URL) await cache.delete(request)
      }
    })
  )
})

/** Only paths on this site: a push payload must never open another origin. */
function sitePath(value) {
  return typeof value === "string" && /^\/(?!\/)/.test(value) ? value : "/ru"
}

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {}
  const title = typeof data.title === "string" ? data.title.slice(0, 120) : "Portfolio+"
  const tasks = [
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body.slice(0, 240) : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      lang: "ru",
      data: { url: sitePath(data.url) },
    }),
  ]
  // The number on the app icon (iOS 16.4+ home-screen apps, desktop PWAs).
  if (typeof data.badge === "number" && self.navigator.setAppBadge) {
    tasks.push(self.navigator.setAppBadge(data.badge).catch(() => {}))
  }
  event.waitUntil(Promise.all(tasks))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(sitePath(event.notification.data?.url), self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue
        await client.focus()
        if ("navigate" in client) await client.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    })()
  )
})

async function networkFirstPage(event) {
  const { request } = event
  try {
    const response = (await event.preloadResponse) || (await fetch(request))
    const url = new URL(request.url)
    const isAuthRedirect = AUTH_PARAMS.some((name) => url.searchParams.has(name))
    if (response.ok && response.type === "basic" && !isAuthRedirect) {
      const copy = response.clone()
      event.waitUntil(
        caches.open(PAGE_CACHE).then(async (cache) => {
          await cache.put(request, copy)
          await trim(cache, MAX_PAGES, [OFFLINE_URL, FAVICON_URL])
        })
      )
    }
    return response
  } catch {
    const cache = await caches.open(PAGE_CACHE)
    return (
      (await cache.match(request)) ||
      // The same page with other filters is better than nothing.
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(OFFLINE_URL)) ||
      Response.error()
    )
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone())
    trim(cache, MAX_STATIC)
  }
  return response
}

/** Drops the oldest entries (cache.keys() is in insertion order), never those in `keep`. */
async function trim(cache, max, keep = []) {
  const keys = await cache.keys()
  const removable = keys.filter((r) => !keep.includes(new URL(r.url).pathname))
  for (const request of removable.slice(0, Math.max(0, removable.length - max))) {
    await cache.delete(request)
  }
}
