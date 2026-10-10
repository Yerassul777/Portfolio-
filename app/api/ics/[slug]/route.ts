import { getDictionary } from "@/lib/i18n"
import { DEFAULT_LOCALE, isEnabledLocale, type Locale } from "@/lib/i18n/config"
import { deadlineCalendar } from "@/lib/ics"
import { getOpportunity } from "@/lib/server-data"
import { SITE_URL, opportunityPath } from "@/lib/site"

// "Add to calendar": the deadline as an .ics file. Public data only, cached
// at the edge for a few minutes.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // ?lang=kz|en: the calendar entry in the reader's language.
  const lang = new URL(request.url).searchParams.get("lang") ?? ""
  const locale: Locale = isEnabledLocale(lang) ? lang : DEFAULT_LOCALE
  const opportunity = await getOpportunity(slug, locale)
  if (!opportunity?.deadline) return new Response("Not found", { status: 404 })

  const t = getDictionary(locale)
  const body = deadlineCalendar(opportunity, `${SITE_URL}${opportunityPath(locale, opportunity.slug)}`, {
    summary: t.reminders.calendarSummary,
    week: t.reminders.calendarWeek,
    day: t.reminders.calendarDay,
  })
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${opportunity.slug}.ics"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  })
}
