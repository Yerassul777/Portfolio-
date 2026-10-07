import { getDictionary } from "@/lib/i18n"
import { DEFAULT_LOCALE, HTML_LANG } from "@/lib/i18n/config"
import { format } from "@/lib/i18n/format"
import { formatDeadline } from "@/lib/deadline"
import { renderPortfolioPdf, type PdfEntry } from "@/lib/portfolio-pdf"
import { createUserClient } from "@/lib/supabase-server"

// The signed-in user's portfolio as a PDF. The entries are read with the
// user's own token (RLS: only theirs); the name is typed in the app, used for
// this file only and never stored or logged.
export const dynamic = "force-dynamic"
export const maxDuration = 30

type Row = {
  title: string
  kind: keyof ReturnType<typeof getDictionary>["portfolio"]["kinds"]
  status: "participating" | "completed"
  result: string
  organizer: string
  event_date: string | null
  description: string
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 2_000) {
    return Response.json({ error: "too large" }, { status: 413 })
  }
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
  const client = token ? createUserClient(token) : null
  if (!client) return Response.json({ error: "auth required" }, { status: 401 })

  let name = ""
  try {
    const body = (await request.json()) as { name?: unknown }
    name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : ""
  } catch {
    return Response.json({ error: "invalid request" }, { status: 400 })
  }

  const { data, error } = await client
    .from("portfolio_entries")
    .select("title, kind, status, result, organizer, event_date, description")
    .order("event_date", { ascending: false, nullsFirst: false })
    .limit(300)
  if (error) {
    return Response.json({ error: "auth required" }, { status: error.code === "PGRST301" ? 401 : 500 })
  }

  const t = getDictionary(DEFAULT_LOCALE)
  const lang = HTML_LANG[DEFAULT_LOCALE]
  const entries: PdfEntry[] = (data as Row[]).map((row) => ({
    title: row.title,
    kind: t.portfolio.kinds[row.kind] ?? "",
    status: row.status,
    result: row.result,
    organizer: row.organizer,
    date: row.event_date ? formatDeadline(row.event_date, "long", lang) : null,
    description: row.description,
  }))

  const today = new Date().toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Almaty" })
  const pdf = await renderPortfolioPdf(name, entries, {
    heading: t.print.heading,
    completed: t.portfolio.sectionCompleted,
    participating: t.portfolio.sectionParticipating,
    generated: format(t.print.generated, { date: today }),
    empty: t.print.empty,
  })

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="portfolio.pdf"',
      "Cache-Control": "private, no-store",
    },
  })
}
