import { timingSafeEqual } from "node:crypto"
import webpush from "web-push"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_LOCALE } from "@/lib/i18n/config"
import { plural } from "@/lib/i18n/format"
import { formatDeadline } from "@/lib/deadline"
import { opportunityPath } from "@/lib/site"
import { createPublicClient } from "@/lib/supabase-server"

// Daily deadline reminders (vercel.json: 04:00 UTC = 09:00 in Almaty).
//
// No service-role key here. The database function claim_due_reminders()
// checks the same secret Vercel sends with every cron call, returns only what
// a reminder needs, and records each one as sent in the same statement, so a
// repeated or overlapping run never sends twice.
export const dynamic = "force-dynamic"
export const maxDuration = 60

type Due = {
  endpoint: string
  p256dh: string
  auth: string
  opportunity_slug: string
  opportunity_title: string
  deadline: string
  days_left: number
  kind: "d7" | "d1"
}

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!secret || !publicKey || !privateKey) {
    return Response.json({ error: "not configured" }, { status: 503 })
  }
  if (!authorized(request, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const client = createPublicClient()
  if (!client) return Response.json({ error: "not configured" }, { status: 503 })

  const { data, error } = await client.rpc("claim_due_reminders", { p_key: secret })
  if (error) {
    console.error("Claiming reminders failed:", error.code)
    return Response.json({ error: "claim failed" }, { status: 500 })
  }

  // The contact push services may use about this sender: the site, not a person.
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://kazakhstanportfolio.vercel.app", publicKey, privateKey)
  const t = getDictionary(DEFAULT_LOCALE)
  const due = (data ?? []) as Due[]
  let sent = 0
  let failed = 0
  let removed = 0

  // Small batches: the job stays well inside its time limit and the push
  // services see a modest rate.
  for (let i = 0; i < due.length; i += 20) {
    await Promise.all(
      due.slice(i, i + 20).map(async (row) => {
        // Only public catalogue data: the notification shows on a lock screen.
        const title =
          row.days_left <= 0
            ? t.card.lastDay
            : row.kind === "d1"
              ? t.reminders.calendarDay
              : plural(DEFAULT_LOCALE, row.days_left, t.card.daysLeft)
        const payload = JSON.stringify({
          title,
          body: `${row.opportunity_title} — ${formatDeadline(row.deadline, "long", "ru")}`,
          url: opportunityPath(DEFAULT_LOCALE, row.opportunity_slug),
          tag: `deadline-${row.opportunity_slug}-${row.kind}`,
        })
        try {
          await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, {
            TTL: 60 * 60 * 20,
            urgency: row.kind === "d1" ? "high" : "normal",
            timeout: 10_000,
          })
          sent++
        } catch (sendError) {
          const status = (sendError as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            // The browser dropped this subscription: forget it.
            await client.rpc("forget_push_endpoint", { p_key: secret, p_endpoint: row.endpoint })
            removed++
          } else {
            failed++
          }
        }
      })
    )
  }

  return Response.json({ due: due.length, sent, failed, removed })
}
