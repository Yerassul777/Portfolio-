// What goes wrong on real devices, and how long the installed app takes to
// open on them — things a test machine cannot show (iOS, old iPads, a slow
// network). Started by instrumentation-client.ts before React hydrates; the
// reports go to /api/diag, an admin reads them in /admin/diagnostics.
//
// Anonymous by design: no account, no IP (the server does not store it), no
// query strings (they can hold a search), short texts only.
//
// - error:  uncaught errors, unhandled rejections and React's recoverable ones
//           (Next.js passes those to window.reportError). A hydration mismatch
//           (#418) also says where: the first node where the server's HTML and
//           the client's render differ.
// - launch: one per start of the installed app — where the time went before
//           the first frame (service worker, HTML, first paint), the opening's
//           steps and how smoothly its frames came.

const ENDPOINT = "/api/diag"
/** A broken page can throw on every frame: this many reports per page load at most. */
const MAX_ERRORS = 10
const SEND_DELAY_MS = 2000
/** Long enough for hydration and React's recovery from a mismatch. */
const WATCH_HYDRATION_MS = 15_000
const MAX_TEXT = 300
const MAX_STACK = 1500

export type LaunchStep = "hydrated" | "intro" | "warm" | "finale" | "landed"

type Report = { kind: "error" | "launch"; report: Record<string, unknown> }

const queue: Report[] = []
const seen = new Set<string>()
const steps: Partial<Record<LaunchStep, number>> = {}
let flushTimer = 0
let started = false
let observer: MutationObserver | null = null

const cut = (text: unknown, max = MAX_TEXT) => String(text ?? "").slice(0, max)
const ms = (value: number | undefined) => (value === undefined || value <= 0 ? undefined : Math.round(value))

/** The address without its query and hash. */
const path = () => location.pathname

function flush() {
  window.clearTimeout(flushTimer)
  flushTimer = 0
  if (!queue.length) return
  const body = JSON.stringify({ build: process.env.NEXT_PUBLIC_BUILD_ID, reports: queue.splice(0) })
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return
  } catch {}
  fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {})
}

/** What the address's query holds (a search) is never sent, not even where the page shows it. */
function scrub(report: Report): Report {
  let text = JSON.stringify(report)
  for (const value of new URLSearchParams(location.search).values()) {
    if (value.length >= 2) text = text.split(value).join("…")
  }
  return JSON.parse(text)
}

function send(report: Report, now = false) {
  queue.push(scrub(report))
  if (now) flush()
  else if (!flushTimer) flushTimer = window.setTimeout(flush, SEND_DELAY_MS)
}

/** The device, as far as it matters for how the app looks and runs. */
function device() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string }; standalone?: boolean }
  const root = document.documentElement.dataset
  return {
    ua: cut(nav.userAgent),
    screen: [screen.width, screen.height, devicePixelRatio],
    viewport: [innerWidth, innerHeight],
    landscape: matchMedia("(orientation: landscape)").matches,
    app: root.app === "1",
    lite: root.lite === "1",
    // An iPad says it is a Mac; touch gives it away.
    touch: nav.maxTouchPoints,
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    net: nav.connection?.effectiveType,
    lang: document.documentElement.lang,
    path: path(),
  }
}

// --- errors -------------------------------------------------------------------

type Difference = { at: string; server: string; client: string }

const SKIPPED = new Set(["SCRIPT", "TEMPLATE", "LINK", "STYLE", "NOSCRIPT"])

/** The nodes a reader sees: no comments, scripts or streaming placeholders. */
function visible(nodes: Iterable<Node>): Node[] {
  return [...nodes].filter((node) => {
    if (node.nodeType === Node.TEXT_NODE) return !!node.textContent?.trim()
    if (!(node instanceof Element)) return false
    // React's streamed content waits in <div hidden id="S:0"> until it is revealed.
    return !SKIPPED.has(node.tagName) && !(node.hasAttribute("hidden") && node.id.startsWith("S:"))
  })
}

/** Text with its invisible characters spelled out: "15 февр. 2027" and "15 февр. 2027" look the same. */
const reveal = (text: string) => text.replace(/[^\S ]|[  -‏ ⁠﻿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)

function describe(node: Node | undefined): string {
  if (!node) return "(nothing)"
  if (!(node instanceof Element)) return `"${reveal(cut(node.textContent?.trim(), 80))}"`
  const classes = typeof node.className === "string" ? node.className.trim().split(/\s+/).slice(0, 3).join(".") : ""
  return `<${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${classes ? `.${classes}` : ""}> "${cut(node.textContent?.trim(), 80)}"`
}

/** The first place where two lists of sibling nodes differ, searched depth first. */
function firstDifference(server: Node[], client: Node[], at: string): Difference | null {
  for (let i = 0; i < Math.max(server.length, client.length); i++) {
    const [a, b] = [server[i], client[i]]
    const here = `${at} > ${a instanceof Element ? a.tagName.toLowerCase() : "#text"}[${i}]`
    if (!a || !b || a.nodeType !== b.nodeType || (a instanceof Element && b instanceof Element && a.tagName !== b.tagName)) {
      return { at: here, server: describe(a), client: describe(b) }
    }
    if (!(a instanceof Element)) {
      if (a.textContent?.trim() !== b.textContent?.trim()) return { at: here, server: describe(a), client: describe(b) }
      continue
    }
    const inner = firstDifference(visible(a.childNodes), visible(b.childNodes), here)
    if (inner) return inner
  }
  return null
}

/**
 * After a mismatch React throws the server's nodes away and renders its own
 * in their place, and reports the error in that same commit: the mutations
 * not yet delivered to the observer are exactly that swap (earlier ones, like
 * streamed content taking a skeleton's place, were delivered and dropped).
 * Compared per parent, in order, they show what the server had and the
 * client wanted.
 */
function hydrationDifference(): Difference | null {
  if (!observer) return null
  const byParent = new Map<Node, { removed: Node[]; added: Node[] }>()
  for (const record of observer.takeRecords()) {
    if (record.type !== "childList") continue
    const entry = byParent.get(record.target) ?? { removed: [], added: [] }
    entry.removed.push(...record.removedNodes)
    entry.added.push(...record.addedNodes)
    byParent.set(record.target, entry)
  }
  for (const [parent, { removed, added }] of byParent) {
    const server = visible(removed)
    if (!server.length) continue
    const difference = firstDifference(server, visible(added), describe(parent).split(" ")[0])
    if (difference) return difference
  }
  return null
}

function recordError(error: unknown, source: string) {
  const err = error instanceof Error ? error : null
  const message = cut(err ? err.message : error)
  const key = `${source}:${message}`
  if (seen.has(key) || seen.size >= MAX_ERRORS) return
  seen.add(key)
  // React's minified messages carry their number: #418 is a hydration mismatch.
  const hydration = /#41[89]|#42[35]|[Hh]ydrat/.test(message)
  send({
    kind: "error",
    report: {
      source,
      name: err?.name,
      message,
      stack: cut(err?.stack, MAX_STACK),
      digest: (err as { digest?: string } | null)?.digest,
      since: ms(performance.now()),
      splash: document.documentElement.dataset.splash === "1",
      ready: document.readyState,
      online: navigator.onLine,
      sw: !!navigator.serviceWorker?.controller,
      // Streamed parts of the page still waiting for their content.
      pending: document.querySelectorAll("template[id^='B:']").length,
      mismatch: hydration ? hydrationDifference() : undefined,
      device: device(),
    },
  })
}

/** For error boundaries (error.tsx): they catch what never reaches window. */
export function reportCaught(error: Error & { digest?: string }, boundary: string) {
  if (started) recordError(error, boundary)
}

// --- the launch ------------------------------------------------------------------

/** A step of the opening, at the time it happens (lib/launch-screen.ts). */
export function markLaunch(step: LaunchStep) {
  steps[step] ??= Math.round(performance.now())
}

export type FrameStats = { frames: number; slow: number; worst: number }

/**
 * Counts animation frames until stopped. "Slow" ones came more than 1.5
 * frames late — on the main thread; the compositor may still have shown the
 * motion smoothly, but a main thread that busy is what stutters. Counting
 * itself costs a main-thread frame on every vsync: only while the main thread
 * is busy anyway.
 */
export function watchFrames(): () => FrameStats {
  const stats: FrameStats = { frames: 0, slow: 0, worst: 0 }
  let last = 0
  let id = requestAnimationFrame(function tick(now) {
    if (last) {
      const gap = now - last
      stats.frames++
      if (gap > 25) stats.slow++
      stats.worst = Math.max(stats.worst, Math.round(gap))
    }
    last = now
    id = requestAnimationFrame(tick)
  })
  return () => {
    cancelAnimationFrame(id)
    return stats
  }
}

/** Sent once the logo has landed: the whole start, from the tap to an app that answers. */
export function reportLaunch(details: Record<string, unknown>) {
  if (!started) return
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
  const paints = performance.getEntriesByType("paint")
  const paint = (name: string) => ms(paints.find((entry) => entry.name === name)?.startTime)
  send(
    {
      kind: "launch",
      report: {
        ...details,
        navigation: nav && {
          type: nav.type,
          // Service worker start, the HTML's first and last byte, the document parsed: from the start of navigation.
          worker: ms(nav.workerStart),
          request: ms(nav.requestStart),
          firstByte: ms(nav.responseStart),
          html: ms(nav.responseEnd),
          parsed: ms(nav.domInteractive),
          loaded: ms(nav.loadEventEnd),
          bytes: nav.transferSize,
          // From public/sw.js: where the page came from, and how long the worker had been running.
          served: nav.serverTiming?.map((entry) => `${entry.name}${entry.description ? `:${entry.description}` : ""}=${Math.round(entry.duration)}`),
        },
        firstPaint: paint("first-paint") ?? paint("first-contentful-paint"),
        steps,
        sw: !!navigator.serviceWorker?.controller,
        device: device(),
      },
    },
    true
  )
}

// --- start ----------------------------------------------------------------------

export function startDiagnostics() {
  if (started || typeof window === "undefined") return
  started = true
  window.addEventListener("error", (event) => {
    // A resource that failed to load (an image) is not an error of the app,
    // and another origin's script error arrives as a bare "Script error.".
    if (!event.error && (!event.message || event.message === "Script error.")) return
    recordError(event.error ?? event.message, "window")
  })
  window.addEventListener("unhandledrejection", (event) => recordError(event.reason, "promise"))
  // Whatever is still queued goes when the app is closed or hidden.
  window.addEventListener("pagehide", flush)
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush())

  if (typeof MutationObserver === "function") {
    // Delivered records are dropped: only a mismatch's own commit is kept (hydrationDifference).
    const watching = new MutationObserver(() => {})
    watching.observe(document.documentElement, { childList: true, subtree: true })
    observer = watching
    window.setTimeout(() => {
      watching.disconnect()
      observer = null
    }, WATCH_HYDRATION_MS)
  }
}
