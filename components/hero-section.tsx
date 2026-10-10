import type { CSSProperties } from "react"
import { GraduationCap, HeartHandshake, Medal, Trophy } from "lucide-react"
import { DeadlineStrip } from "@/components/deadline-strip"
import { HeroSearch } from "@/components/hero-search"
import type { Highlights } from "@/lib/catalogue"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { plural } from "@/lib/i18n/format"

// The counts are social proof only once they are big enough to impress.
const STATS_MIN_TOTAL = 20

// The four sections as floating 3D tiles around the heading (wide screens
// only; globals.css "Home screen"). Positions in % of the hero.
const TILES = [
  { icon: Trophy, top: "16%", left: "7%", rx: "14deg", ry: "22deg", delay: "0s" },
  { icon: Medal, top: "58%", left: "11%", rx: "-10deg", ry: "28deg", delay: "-2.5s" },
  { icon: GraduationCap, top: "18%", right: "8%", rx: "12deg", ry: "-24deg", delay: "-1.2s" },
  { icon: HeartHandshake, top: "60%", right: "12%", rx: "-14deg", ry: "-20deg", delay: "-4s" },
]

interface HeroSectionProps {
  locale: Locale
  t: Dictionary
  /**
   * Short version for category pages and shared links with filters, so a
   * visitor arriving from a link lands on the results, not on a splash screen.
   */
  compact?: boolean
  /** Nearest deadlines and counts; the home page only. */
  highlights?: Highlights | null
}

export function HeroSection({ locale, t, compact = false, highlights = null }: HeroSectionProps) {
  const showStats = !compact && highlights !== null && highlights.openTotal >= STATS_MIN_TOTAL

  return (
    <section className={`relative overflow-hidden ${compact ? "py-12 sm:py-16" : "py-10 sm:py-16 lg:py-20"}`}>
      {/* Glows as radial gradients: same look as blurred circles, none of the raster cost on phones. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(circle at 78% 35%, rgba(16,185,129,0.1), transparent 460px)",
            "radial-gradient(circle at 22% 75%, rgba(5,150,105,0.08), transparent 400px)",
            "linear-gradient(to bottom right, #0a0f0d, #0d1a14, #0f261c)",
          ].join(","),
          // Fades out into whatever is behind it, so the hero has no bottom edge.
          maskImage: "linear-gradient(to bottom, black 55%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)",
        }}
      />
      {!compact && (
        // Decoration behind the text: drifting lights, a 3D grid floor, floating tiles.
        <div aria-hidden="true">
          <div className="hero-aurora">
            <i />
            <i />
            <i />
          </div>
          <div className="hero-floor">
            <i />
          </div>
          {TILES.map(({ icon: Icon, top, left, right, rx, ry, delay }, index) => (
            <span key={index} className="hero-tile" style={{ top, left, right, "--rx": rx, "--ry": ry, "--delay": delay } as CSSProperties}>
              <Icon className="h-8 w-8" strokeWidth={1.75} />
            </span>
          ))}
        </div>
      )}

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mx-auto max-w-4xl text-center ${compact ? "space-y-5" : "space-y-6 sm:space-y-8"}`}>
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
            {t.hero.badge}
          </p>

          <div className="space-y-3 sm:space-y-4">
            <h1 className={`font-bold tracking-tight ${compact ? "text-4xl sm:text-5xl" : "text-4xl sm:text-6xl lg:text-7xl"}`}>
              <span className="text-white">{t.hero.titleLine1}</span>
              {/* Always two lines: their height must not depend on which font rendered them. */}
              <br />
              <span className={compact ? "bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500 bg-clip-text text-transparent" : "text-sheen"}>
                {t.hero.titleLine2}
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-balance text-base leading-relaxed text-gray-400 sm:text-lg">
              {t.hero.subtitle}
            </p>
          </div>

          {!compact && <HeroSearch />}

          {showStats && (
            <p className="text-sm text-gray-400">
              <span className="font-medium text-emerald-300">{plural(locale, highlights.openTotal, t.hero.openCount)}</span>
              {highlights.closingSoon > 0 && (
                <>
                  {" · "}
                  <span className="text-amber-300">{plural(locale, highlights.closingSoon, t.hero.closingSoon)}</span>
                </>
              )}
            </p>
          )}
        </div>

        {!compact && highlights && highlights.soon.length > 0 && (
          <div className="mt-10 sm:mt-12">
            <DeadlineStrip items={highlights.soon} />
          </div>
        )}
      </div>
    </section>
  )
}
