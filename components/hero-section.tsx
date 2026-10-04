import { DeadlineStrip } from "@/components/deadline-strip"
import { HeroSearch } from "@/components/hero-search"
import type { Highlights } from "@/lib/catalogue"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { plural } from "@/lib/i18n/format"

// The counts are social proof only once they are big enough to impress.
const STATS_MIN_TOTAL = 20

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
            "linear-gradient(to bottom, transparent 55%, #0a0f0d)",
            "radial-gradient(circle at 78% 35%, rgba(16,185,129,0.1), transparent 460px)",
            "radial-gradient(circle at 22% 75%, rgba(5,150,105,0.08), transparent 400px)",
            "linear-gradient(to bottom right, #0a0f0d, #0d1a14, #0f261c)",
          ].join(","),
        }}
      />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mx-auto max-w-4xl text-center ${compact ? "space-y-5" : "space-y-6 sm:space-y-8"}`}>
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
            {t.hero.badge}
          </p>

          <div className="space-y-3 sm:space-y-4">
            <h1 className={`font-bold tracking-tight ${compact ? "text-4xl sm:text-5xl" : "text-4xl sm:text-6xl lg:text-7xl"}`}>
              <span className="text-white">{t.hero.titleLine1}</span>{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500 bg-clip-text text-transparent">
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
