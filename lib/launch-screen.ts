"use client"

import { useEffect } from "react"
import { markLaunch, reportLaunch, watchFrames, type FrameStats } from "@/lib/diagnostics"

// The installed app's launch screen (markup in app/[locale]/layout.tsx, look
// in globals.css "Launch screen"). <html data-splash> is set by the inline
// script before the first paint and removed when the logo has landed; the
// phases are on the screen itself (#app-splash[data-phase]), so a change of
// phase restyles only the screen, not the whole page:
//
//   "hold"   hold   — the still logo, for as long as the app needs to start
//                     (hydration, fonts) but not shorter than HOLD_MIN_MS:
//                     iOS's hand-over from its launch image is over before
//                     anything moves.
//   "intro"  intro  — the same opening on every start: sparks gather into the
//                     tile, it breathes and sends out a ring of light, the
//                     orbit, the name and "by Team KAYA" appear. Transform and
//                     opacity only: it runs on the compositor while, behind
//                     it, the screens' code and one render of each warm up
//                     (`prewarm`), so the first tap on a tab is as quick as
//                     later ones.
//   "done"   finale — one timeline (`finale`): the coin turns over once as it
//                     flies into the header's socket, and the turn ends as it
//                     lands; the screen fades on the way. It starts once the
//                     warm-up is done (or given up on), so it has the main
//                     thread to itself.
//   (none)          — landed: the screen is gone and the header's own logo,
//                     the same picture in the same place, is there in that
//                     same frame. Until then the screen takes every tap; from
//                     then on the app answers at once.
//
// A tap during the intro skips to the finale. Reduced motion: hold, then a fade.
// Each start is reported (lib/diagnostics.ts): its steps and how smooth it was.

/** From the first paint: the still logo at least this long. */
const HOLD_MIN_MS = 250
/** From the first paint: the intro starts even if the fonts never report ready. */
const HOLD_MAX_MS = 3000
/** The opening, until the finale (globals.css: the last part ends at ~0.95 s). */
const INTRO_MS = 1000
/** After the intro, the finale waits this long at most for the warm-up. */
const WARM_MAX_MS = 1500
/** The finale: turn and flight share it from the first frame to the last. */
const FINALE_MS = 750
/** Slow to leave, quick through the middle, a soft landing. */
const FINALE_EASING: Bezier = [0.5, 0, 0.2, 1]
/** No flight (reduced motion, or no header on the page): the screen fades. */
const FADE_MS = 450
/** The socket's ring of light after the landing (globals.css). */
const LANDED_MS = 700
/** A coin that lands further than this from the header's logo is caught up by it. */
const LANDING_TOLERANCE_PX = 0.5
const CATCH_UP_MS = 160
/** Consecutive smooth frames that count as "the main thread is free". */
const QUIET_FRAMES = 4
const QUIET_FRAME_MS = 34
const QUIET_MAX_MS = 500
/** The report waits for the page's load to finish, so its timings are complete. */
const REPORT_DELAY_MS = 1000

type Bezier = [number, number, number, number]

const cubicBezier = ([x1, y1, x2, y2]: Bezier) => `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`

/** The share of the time at which an easing (with y1, y2 in 0..1) reaches `progress`. */
function timeAt([x1, y1, x2, y2]: Bezier, progress: number): number {
  const at = (p1: number, p2: number, s: number) => 3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s ** 2 * (1 - s) + s ** 3
  let low = 0
  let high = 1
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2
    if (at(y1, y2, mid) < progress) low = mid
    else high = mid
  }
  return at(x1, x2, (low + high) / 2)
}

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
  // Safari reports only first-contentful-paint.
  const paints = performance.getEntriesByType("paint")
  const paint = paints.find((entry) => entry.name === "first-paint") ?? paints.find((entry) => entry.name === "first-contentful-paint")
  return paint?.startTime ?? performance.now()
}

const center = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })

/**
 * The coin turns over once while it flies from the middle of the screen into
 * `socket`, and the screen fades. Every part starts in the same frame, and the
 * turn and the flight end in the same frame. Which side shows is switched by
 * opacity exactly when the coin is edge-on (90° and 270°, worked out from the
 * curve): it does not rely on backface-visibility, which some WebKit builds
 * get wrong (the front would show mirrored instead of the back).
 * Called before the phase changes to "done": the lift starts from wherever
 * the intro's breath has it (a tap may skip there mid-breath), as an explicit
 * value — the breath itself stops with the phase, so the lift is the only
 * animation of its element and runs on the compositor.
 */
function finale(splash: HTMLElement, socket: HTMLElement): Animation[] {
  const part = (selector: string) => splash.querySelector<HTMLElement>(selector)
  const [stage, lift, logo, face, back, bg] = [".splash-stage", ".splash-lift", ".splash-logo", ".splash-face", ".splash-back", ".splash-bg"].map(part)
  if (!stage || !lift || !logo || !face || !back || !bg) return []
  const from = stage.getBoundingClientRect()
  const to = socket.getBoundingClientRect()
  const [start, end] = [center(from), center(to)]
  const breath = getComputedStyle(lift).transform
  const liftFrom = breath === "none" ? "scale(1)" : breath
  const turn: KeyframeAnimationOptions = { duration: FINALE_MS, easing: cubicBezier(FINALE_EASING), fill: "forwards" }
  const span: KeyframeAnimationOptions = { duration: FINALE_MS, fill: "forwards" }
  const edgeOn = timeAt(FINALE_EASING, 0.25)
  const backAway = timeAt(FINALE_EASING, 0.75)
  const animations = [
    stage.animate([{ transform: "none" }, { transform: `translate(${end.x - start.x}px, ${end.y - start.y}px) scale(${to.width / from.width})` }], turn),
    logo.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(360deg)" }], turn),
    // Lifted towards the viewer while it turns.
    lift.animate([{ transform: liftFrom }, { transform: "scale(1.16)", offset: 0.4 }, { transform: "scale(1)" }], { ...span, easing: "ease-in-out" }),
    face.animate(
      [{ opacity: 1 }, { opacity: 1, offset: edgeOn }, { opacity: 0, offset: edgeOn }, { opacity: 0, offset: backAway }, { opacity: 1, offset: backAway }, { opacity: 1 }],
      span
    ),
    back.animate(
      [{ opacity: 0 }, { opacity: 0, offset: edgeOn }, { opacity: 1, offset: edgeOn }, { opacity: 1, offset: backAway }, { opacity: 0, offset: backAway }, { opacity: 0 }],
      span
    ),
    // Gone before the coin arrives: the socket is in view for it to land in.
    bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FINALE_MS * 0.6, delay: FINALE_MS * 0.1, easing: "ease-out", fill: "forwards" }),
  ]
  const now = document.timeline.currentTime
  for (const animation of animations) animation.startTime = now
  return animations
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
    markLaunch("hydrated")
    const phase = (name: "hold" | "intro" | "done") => (splash.dataset.phase = name)
    phase("hold")
    const painted = firstPaint()
    const since = () => performance.now() - painted
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const warmUp = new AbortController()
    let cancelled = false
    let animations: Animation[] = []
    let skip: () => void = () => {}
    const skipped = new Promise<void>((resolve) => (skip = resolve))
    const onTap = () => {
      if (splash.dataset.phase === "intro") skip()
    }
    splash.addEventListener("pointerdown", onTap)
    // Counted in the intro only: counting needs a frame of the main thread on
    // every vsync, which the finale (compositor only) must not be given. How
    // smooth the finale was shows in its length (from "finale" to "landed").
    let introFrames: FrameStats | undefined
    let stopWatching: () => FrameStats = () => ({ frames: 0, slow: 0, worst: 0 })

    // The screen and the coin go and the header's logo shows, in one frame. A
    // coin that came down off the mark (the page moved under it) is caught up
    // by the logo itself, from where the coin is, rather than with a jump.
    const land = (socket: HTMLElement | null) => {
      if (cancelled) return
      const coin = splash.querySelector(".splash-face")?.getBoundingClientRect()
      delete root.dataset.splash
      delete splash.dataset.phase
      for (const animation of animations) animation.cancel()
      root.dataset.landed = "1"
      markLaunch("landed")
      window.setTimeout(() => delete root.dataset.landed, LANDED_MS)
      let off: number | undefined
      if (socket && coin) {
        const home = socket.getBoundingClientRect()
        const [from, to] = [center(coin), center(home)]
        off = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y), Math.abs(coin.width - home.width))
        if (off > LANDING_TOLERANCE_PX && home.width > 0) {
          socket.animate(
            [{ transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${coin.width / home.width})` }, { transform: "none" }],
            { duration: CATCH_UP_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" }
          )
        }
      }
      window.setTimeout(() => reportLaunch({ still, introFrames, landingOffPx: off === undefined ? undefined : Math.round(off * 10) / 10 }), REPORT_DELAY_MS)
    }

    const leave = () => {
      if (cancelled) return
      if (!still) introFrames = stopWatching()
      markLaunch("finale")
      const socket = document.querySelector<HTMLElement>("[data-brand-logo]")
      const rect = socket?.getBoundingClientRect()
      if (still || !socket || !rect || rect.width === 0 || rect.bottom <= 0) {
        phase("done")
        const fade = splash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease", fill: "forwards" })
        animations = [fade]
        fade.finished.then(() => land(null), () => land(null))
        return
      }
      animations = finale(splash, socket)
      phase("done")
      const [flight] = animations
      if (flight) flight.finished.then(() => land(socket), () => land(socket))
      else land(socket)
    }

    void (async () => {
      // Hold. Fonts first of all: the name must not change its face in the
      // middle of the opening.
      await Promise.race([document.fonts?.ready, wait(HOLD_MAX_MS - since())])
      await wait(HOLD_MIN_MS - since())
      await quietFrames(QUIET_FRAMES, QUIET_MAX_MS)
      if (cancelled) return
      const introEnd = performance.now() + (still ? 0 : INTRO_MS)
      if (!still) {
        phase("intro")
        markLaunch("intro")
        stopWatching = watchFrames()
        // The intro's start is drawn before the warm-up takes the main thread.
        await frame()
        await frame()
      }
      const warming = prewarm(warmUp.signal)
        .catch(() => {})
        .then(() => markLaunch("warm"))
      // The intro plays to its end (or a tap), and the screens are warm — or
      // given up on, so a slow device does not hold the logo for long.
      const left = introEnd - performance.now()
      await Promise.race([Promise.all([wait(left), warming]), skipped, wait(left + WARM_MAX_MS)])
      warmUp.abort()
      await warming
      await quietFrames(QUIET_FRAMES, QUIET_MAX_MS)
      leave()
    })()

    return () => {
      cancelled = true
      warmUp.abort()
      stopWatching()
      splash.removeEventListener("pointerdown", onTap)
    }
    // Once per start: the prewarm function may change identity, the launch does not restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
