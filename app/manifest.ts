import type { MetadataRoute } from "next"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_LOCALE, HTML_LANG } from "@/lib/i18n/config"

// What Android, Windows and desktop Chrome/Edge read to install the site as an
// app: name, icons, colours of the splash screen, and the window style.
export default function manifest(): MetadataRoute.Manifest {
  const t = getDictionary(DEFAULT_LOCALE)
  return {
    id: "/",
    name: t.meta.title,
    short_name: t.meta.siteName,
    description: t.meta.description,
    lang: HTML_LANG[DEFAULT_LOCALE],
    start_url: `/${DEFAULT_LOCALE}`,
    scope: "/",
    display: "standalone",
    background_color: "#0a0f0d",
    theme_color: "#0a0f0d",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
