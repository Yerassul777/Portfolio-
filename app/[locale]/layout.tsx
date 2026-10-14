import type { CSSProperties, ReactNode } from "react"
import type { Metadata, Viewport } from "next"
import { AuthProvider } from "@/components/auth-provider"
import { BrandMark } from "@/components/brand-mark"
import { I18nProvider } from "@/components/i18n-provider"
import { PwaSetup } from "@/components/install-app"
import { SiteAnalytics } from "@/components/site-analytics"
import { TodayProvider } from "@/components/today-provider"
import { APP_MODE_SCRIPT } from "@/lib/app-mode"
import { todayInAlmaty } from "@/lib/deadline"
import { LAUNCH_SCREENS } from "@/lib/launch-screens"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_LOCALE, ENABLED_LOCALES, HTML_LANG, OG_LOCALE, isEnabledLocale, type Locale } from "@/lib/i18n/config"
import { SITE_URL } from "@/lib/site"
import { fontClassName } from "@/lib/fonts"
import "../globals.css"

/** Sparks that gather into the launch screen's logo: [angle, delay in s]. */
const SPLASH_SPARKS: [number, number][] = [
  [0, 0], [30, 0.13], [60, 0.05], [90, 0.17], [120, 0.08], [150, 0.02], [180, 0.15], [210, 0.06], [240, 0.19], [270, 0.1], [300, 0.03], [330, 0.12],
]

/** Slabs behind the launch screen's logo: its thickness when it turns over. */
const SPLASH_DEPTH = [1, 2, 3, 4, 5, 6]

export function generateStaticParams() {
  return ENABLED_LOCALES.map((locale) => ({ locale }))
}

type LocaleLayoutProps = { children: ReactNode; params: Promise<{ locale: string }> }

// A first segment that is not a locale (/xyz) still renders this layout, in
// the default locale, so the nested layouts' notFound() can show the site's
// own 404 page (with header and a way back) and a real 404 status.
async function resolveLocale(params: LocaleLayoutProps["params"]): Promise<Locale> {
  const { locale } = await params
  return isEnabledLocale(locale) ? locale : DEFAULT_LOCALE
}

export async function generateMetadata({ params }: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const locale = await resolveLocale(params)
  const t = getDictionary(locale)
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t.meta.title, template: `%s — ${t.meta.siteName}` },
    description: t.meta.description,
    applicationName: t.meta.siteName,
    openGraph: {
      type: "website",
      siteName: t.meta.siteName,
      locale: OG_LOCALE[locale],
      title: t.meta.title,
      description: t.meta.description,
    },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
    // iOS has no install prompt and ignores most of the manifest: these make
    // "Add to Home Screen" open the site full-screen, like an app.
    appleWebApp: {
      capable: true,
      title: t.meta.siteName,
      statusBarStyle: "black-translucent",
      startupImage: LAUNCH_SCREENS,
    },
  }
}

export const viewport: Viewport = {
  themeColor: "#0a0f0d",
  colorScheme: "dark",
  // Lets the layout extend under the notch; padding uses env(safe-area-inset-*).
  viewportFit: "cover",
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const locale = await resolveLocale(params)
  const t = getDictionary(locale)

  return (
    // suppressHydrationWarning: the script below adds data-app to <html> before React hydrates.
    <html lang={HTML_LANG[locale]} className={`dark ${fontClassName}`} suppressHydrationWarning>
      <head>
        {/* Installed app or website, decided before the first paint (lib/app-mode.ts). */}
        <script dangerouslySetInnerHTML={{ __html: APP_MODE_SCRIPT }} />
        {/* Next writes only the standard "mobile-web-app-capable"; iOS still
            needs its own name to use the launch images above. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* The page's colour before its stylesheet arrives: never a white flash. */}
        <style>{"html{background:#0a0f0d}"}</style>
      </head>
      <body className="font-sans antialiased">
        {/* The installed app's launch screen: lib/launch-screen.ts runs it, globals.css
            ("Launch screen") draws it; hidden on the website. */}
        <div id="app-splash" aria-hidden="true">
          <div className="splash-bg" />
          <div className="splash-stage">
            <div className="splash-halo">
              <span className="splash-glow" />
              <span className="splash-bloom" />
              <span className="splash-wave" />
              <div className="splash-orbit">
                <div className="splash-orbit-ring" />
              </div>
              <div className="splash-sparks">
                {SPLASH_SPARKS.map(([angle, delay]) => (
                  <i key={angle} style={{ "--a": `${angle}deg`, "--delay": delay } as CSSProperties} />
                ))}
              </div>
            </div>
            <div className="splash-lift">
              <div className="splash-logo">
                <div className="splash-depth">
                  {SPLASH_DEPTH.map((d) => (
                    <i key={d} style={{ "--d": d } as CSSProperties} />
                  ))}
                </div>
                <div className="splash-back">
                  <BrandMark id="splash-back" />
                </div>
                <div className="splash-face">
                  <BrandMark id="splash-face" />
                  <span className="splash-sheen" />
                </div>
              </div>
            </div>
          </div>
          <div className="splash-name">
            {Array.from("Portfolio+").map((letter, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties}>
                {letter}
              </span>
            ))}
          </div>
          <div className="splash-credit">
            <div className="splash-credit-row">
              <span className="splash-line" />
              <span>
                by <b>Team KAYA</b>
              </span>
              <span className="splash-line" />
            </div>
          </div>
          {/* Never seen (globals.css): what lets iOS show the first frame before the whole page is parsed. */}
          <p className="splash-milestone">
            {t.meta.description} {t.hero.subtitle}
          </p>
        </div>
        <I18nProvider locale={locale} dictionary={t}>
          <TodayProvider today={todayInAlmaty()}>
            <AuthProvider>{children}</AuthProvider>
          </TodayProvider>
        </I18nProvider>
        {/* The analytics script exists only on Vercel; elsewhere (Docker, CI, local) it is a 404 in the console. */}
        {process.env.VERCEL && <SiteAnalytics />}
        <PwaSetup />
      </body>
    </html>
  )
}
