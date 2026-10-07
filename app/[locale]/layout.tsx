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
      </head>
      <body className="font-sans antialiased">
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
