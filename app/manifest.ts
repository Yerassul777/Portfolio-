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
    // "/" goes to the language the user chose (next.config.mjs redirects).
    start_url: "/",
    scope: "/",
    // On a desktop the app draws its own title bar (app-shell.tsx), so the
    // window has no browser-looking bar with the address; elsewhere, standalone.
    display_override: ["window-controls-overlay", "standalone"],
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
