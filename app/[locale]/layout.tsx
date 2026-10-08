import type { ReactNode } from "react"
import type { Metadata, Viewport } from "next"
import { AuthProvider } from "@/components/auth-provider"
import { I18nProvider } from "@/components/i18n-provider"
import { PwaSetup } from "@/components/install-app"
import { SiteAnalytics } from "@/components/site-analytics"
import { APP_MODE_SCRIPT } from "@/lib/app-mode"
import { LAUNCH_SCREENS } from "@/lib/launch-screens"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_LOCALE, ENABLED_LOCALES, HTML_LANG, OG_LOCALE, isEnabledLocale, type Locale } from "@/lib/i18n/config"
import { SITE_URL } from "@/lib/site"
import { fontClassName } from "@/lib/fonts"
import "../globals.css"

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

  return (
    // suppressHydrationWarning: the script below adds data-app to <html> before React hydrates.
    <html lang={HTML_LANG[locale]} className={`dark ${fontClassName}`} suppressHydrationWarning>
      <head>
        {/* Installed app or website, decided before the first paint (lib/app-mode.ts). */}
        <script dangerouslySetInnerHTML={{ __html: APP_MODE_SCRIPT }} />
        {/* Next writes only the standard "mobile-web-app-capable"; iOS still
            needs its own name to use the launch images above. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased">
        {/* The installed app's launch screen (globals.css, "Launch screen"); hidden on the website. */}
        <div id="app-splash" aria-hidden="true">
          <div className="splash-logo">
            <span className="splash-glow" />
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="splash-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#10b981" />
                  <stop offset="1" stopColor="#16a34a" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="14" fill="url(#splash-gradient)" />
              <path fill="#fff" d="M17.51 43.85L12.16 43.85L12.16 18.87L22.15 18.87Q26.65 18.87 29.20 21.05Q31.75 23.23 31.75 27.03L31.75 27.03Q31.75 29.53 30.61 31.38Q29.47 33.22 27.30 34.23Q25.14 35.23 22.15 35.23L22.15 35.23L17.51 35.23L17.51 43.85ZM17.51 23.37L17.51 30.73L21.83 30.73Q23.94 30.73 25.11 29.79Q26.27 28.86 26.27 27.03L26.27 27.03Q26.27 25.24 25.12 24.31Q23.98 23.37 21.83 23.37L21.83 23.37L17.51 23.37ZM45.37 42.37L41.08 42.37L41.08 25.13L45.37 25.13L45.37 42.37ZM51.84 35.90L34.60 35.90L34.60 31.64L51.84 31.64L51.84 35.90Z" />
            </svg>
          </div>
          <div className="splash-name">Portfolio+</div>
          <div className="splash-credit">by Team KAYA</div>
        </div>
        <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
        {/* The analytics script exists only on Vercel; elsewhere (Docker, CI, local) it is a 404 in the console. */}
        {process.env.VERCEL && <SiteAnalytics />}
        <PwaSetup />
      </body>
    </html>
  )
}
