"use client"

import { useEffect } from "react"

// The installed app's launch screen (markup in app/[locale]/layout.tsx, look
// in globals.css "Launch screen"). <html data-splash> is set by the inline
// script before the first paint and removed at the very end; the phases are on
// the screen itself (#app-splash[data-phase]), so a change of phase restyles
// only the screen, not the whole page:
//
//   "hold"   hold   — the still logo, from the very first frame. Behind it the
//                     app warms up: the screens' code, their data, one render
//                     of each, so the first tap on a tab is as quick as later
//                     ones (`prewarm`).
//   "intro"  intro  — starts only when the app is ready and the main thread
//                     has been quiet for a few frames, so nothing competes
//                     with the animation: sparks gather into the tile, it
//                     breathes and sends out a ring of light, the orbit, the
//                     name and "by Team KAYA" appear. Transform and opacity
//                     only: it runs on the compositor.
//   "done"   exit   — the logo turns over once, a coin with its thickness, as
//                     it flies into the header's logo; the screen fades
//                     (opacity of its own layer, no repaint).
//   "landed"        — a short cross-fade into the real header logo; the page's
//                     own decoration starts moving again.
//   (none)          — gone.
//
// A tap during the intro skips to the exit. Reduced motion: hold, then a fade.

/** The logo alone, at least, from the first paint (the person asked for 1–2 s). */
const HOLD_MIN_MS = 1200
/** From the first paint: the intro starts even if warming up has not finished. */
const HOLD_MAX_MS = 4200
/** The opening, until the logo leaves (globals.css: the last part ends at ~2.45 s). */
const INTRO_MS = 2900
/** The logo's flight into the header. It turns over once (1 s, globals.css),
 * starting in place: the flight sets off a moment later. */
const FLIGHT_DELAY_MS = 200
const FLIGHT_MS = 1050
/** The cross-fade into the header's own logo. */
const LANDING_MS = 220
/** Consecutive smooth frames that count as "the main thread is free". */
const QUIET_FRAMES = 8
const QUIET_FRAME_MS = 34
const QUIET_MAX_MS = 1200

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, ms)))
const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

/** Resolves after `count` frames in a row came on time, or after `max` ms. */
async function quietFrames(count: number, max: number) {
  const end = performance.now() + max
  let last = await frame()
  let smooth = 0
  while (smooth < count && performance.now() < end) {
    const now = await frame()
    smooth = now - last <= QUIET_FRAME_MS ? smooth + 1 : 0
    last = now
  }
}

function firstPaint(): number {
  const paint = performance.getEntriesByType("paint").find((entry) => entry.name === "first-paint")
  return paint?.startTime ?? performance.now()
}

/**
 * Runs the launch screen if this start shows one. `prewarm` renders the
 * app's screens behind it; it must stop and close them soon after `signal`
 * aborts.
 */
export function useLaunchScreen(prewarm: (signal: AbortSignal) => Promise<void>) {
  useEffect(() => {
    const root = document.documentElement
    const splash = document.getElementById("app-splash")
    if (root.dataset.splash !== "1" || !splash) return
    const phase = (name: "hold" | "intro" | "done" | "landed") => (splash.dataset.phase = name)
    phase("hold")
    const painted = firstPaint()
    const since = () => performance.now() - painted
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const warmUp = new AbortController()
    let cancelled = false
    let skip: () => void = () => {}
    const skipped = new Promise<void>((resolve) => (skip = resolve))
    const onTap = () => {
      if (splash.dataset.phase === "intro") skip()
    }
    splash.addEventListener("pointerdown", onTap)

    const leave = () => {
      if (cancelled) return
      const stage = splash.querySelector<HTMLElement>(".splash-stage")
      const target = document.querySelector<HTMLElement>("[data-brand-logo]")
      const from = stage?.getBoundingClientRect()
      const to = target?.getBoundingClientRect()
      phase("done")
      const end = () => {
        delete root.dataset.splash
        delete splash.dataset.phase
      }
      const gone = () => {
        if (cancelled) return
        phase("landed")
        delete root.dataset.splash
        window.setTimeout(() => {
          if (!cancelled) delete splash.dataset.phase
        }, LANDING_MS)
      }
      if (!still && stage && from && to && to.width > 0 && to.bottom > 0) {
        // Centre to centre, and the tile's size to the header logo's.
        const dx = to.left + to.width / 2 - (from.left + from.width / 2)
        const dy = to.top + to.height / 2 - (from.top + from.height / 2)
        const flight = stage.animate(
          [{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width})` }],
          { duration: FLIGHT_MS, delay: FLIGHT_DELAY_MS, easing: "cubic-bezier(0.6, 0, 0.2, 1)", fill: "forwards" }
        )
        flight.finished.then(gone, gone)
      } else {
        // No flight: the whole screen fades (globals.css), then it is gone.
        window.setTimeout(() => {
          if (!cancelled) end()
        }, 450)
      }
    }

    void (async () => {
      // Hold: warm up behind the logo, for as long as it takes but not longer
      // than HOLD_MAX_MS from the first paint. Fonts first of all: the name
      // must not change its face in the middle of the opening.
      const warming = prewarm(warmUp.signal).catch(() => {})
      await Promise.race([Promise.all([warming, document.fonts?.ready]), wait(HOLD_MAX_MS - since())])
      warmUp.abort()
      await warming
      await wait(HOLD_MIN_MS - since())
      await quietFrames(QUIET_FRAMES, QUIET_MAX_MS)
      if (cancelled) return
      if (still) return leave()
      phase("intro")
      await Promise.race([wait(INTRO_MS), skipped])
      leave()
    })()

    return () => {
      cancelled = true
      warmUp.abort()
      splash.removeEventListener("pointerdown", onTap)
    }
    // Once per start: the prewarm function may change identity, the launch does not restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
