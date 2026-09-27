import type { MetadataRoute } from "next"
import { ENABLED_LOCALES } from "@/lib/i18n/config"
import { SITE_URL, adminPath } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...ENABLED_LOCALES.map(adminPath)],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
