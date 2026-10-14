import { clientKey, createRateLimit } from "@/lib/rate-limit"
import { createPublicClient } from "@/lib/supabase-server"

// Diagnostic reports from browsers (lib/diagnostics.ts) on their way to the
// database. The route holds the cron secret that diag_report() checks, so
// reports can only come through here, where each address is limited. The
// address is the limiter's key only: it is not stored.
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 32_000
/** The database refuses larger ones (client_reports.report). */
const MAX_REPORT_BYTES = 7_000
const MAX_REPORTS = 20
// A start of the app is one report, a broken page up to ten: plenty of room.
const rateLimit = createRateLimit(60, 10 * 60 * 1000)

type Incoming = { kind?: unknown; report?: unknown }

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const client = createPublicClient()
  if (!secret || !client) return new Response(null, { status: 503 })
  if (!rateLimit(clientKey(request)).allowed) return new Response(null, { status: 429 })

  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return new Response(null, { status: 413 })
  let body: { build?: unknown; reports?: unknown }
  try {
    body = JSON.parse(text)
  } catch {
    return new Response(null, { status: 400 })
  }

  const reports = (Array.isArray(body.reports) ? (body.reports as Incoming[]) : [])
    .filter(
      (r) =>
        (r?.kind === "error" || r?.kind === "launch") &&
        typeof r.report === "object" &&
        r.report !== null &&
        !Array.isArray(r.report) &&
        Buffer.byteLength(JSON.stringify(r.report)) <= MAX_REPORT_BYTES
    )
    .slice(0, MAX_REPORTS)
  if (!reports.length) return new Response(null, { status: 400 })

  const build = typeof body.build === "string" ? body.build.slice(0, 40) : null
  const { error } = await client.rpc("diag_report", { p_key: secret, p_build: build, p_reports: reports })
  if (error) {
    console.error("Storing diagnostics failed:", error.code)
    return new Response(null, { status: 500 })
  }
  return new Response(null, { status: 204 })
}
