import { timingSafeEqual } from "node:crypto"
import { todayInAlmaty } from "@/lib/deadline"
import { extractOpportunity, KINDS, pageText, type FilterVocabulary, type Kind } from "@/lib/ingest/extract"
import { fetchPage, loadRobots, matchingLinks, robotsAllows } from "@/lib/ingest/web"
import { createPublicClient, createUserClient } from "@/lib/supabase-server"
import { CATEGORY_LABELS, FILTER_CONFIGS } from "@/lib/types"

// Phase 6: the daily search for new opportunities (see the migration
// 20261009090000_ingestion.sql). Started by Vercel Cron, or by an admin with
// "Запустить сейчас". Every find goes to the review queue as 'pending'; in a
// dry run nothing is written to the catalogue, the run only reports.
//
// Limits per run: the time budget, at most MAX_LLM_CALLS model calls, and
// each source's own max_new_per_run. Pages are fetched one at a time, one
// request per second per site; the model reads up to PARALLEL of them at
// once, so a run fits in a minute.

export const maxDuration = 60

const TIME_BUDGET_MS = 45_000
const MAX_LLM_CALLS = 40
const PAUSE_MS = 1_000
const PARALLEL = 4

type Source = { id: string; name: string; listing_url: string; link_pattern: string; kind_hint: Kind | null; max_new_per_run: number }
type Report = { url: string; source: string; outcome: string; title?: string; kind?: string; deadline?: string | null; evidence?: string | null; confidence?: number; reason?: string }

const vocabulary = Object.fromEntries(
  KINDS.map((kind) => [kind, FILTER_CONFIGS[kind].map((f) => ({ key: f.key as string, values: f.options.map((o) => o.value) }))])
) as FilterVocabulary

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function cronAuthorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Vercel Cron (GET, the cron secret) or an admin (POST, their session). */
async function authorize(request: Request, secret: string): Promise<"cron" | "manual" | null> {
  if (cronAuthorized(request, secret)) return "cron"
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  const client = token ? createUserClient(token) : null
  if (!client || !token) return null
  const { data: auth } = await client.auth.getUser(token)
  if (!auth?.user) return null
  const { data: isAdmin } = await client.rpc("is_admin")
  return isAdmin === true ? "manual" : null
}

async function run(request: Request, wantDry: boolean) {
  const secret = process.env.CRON_SECRET
  const apiKey = process.env.OPENAI_API_KEY
  if (!secret || !apiKey) return Response.json({ error: "not configured" }, { status: 503 })
  const trigger = await authorize(request, secret)
  if (!trigger) return Response.json({ error: "unauthorized" }, { status: 401 })
  if (process.env.INGEST_DISABLED === "true") return Response.json({ error: "disabled" }, { status: 503 })

  const db = createPublicClient()
  if (!db) return Response.json({ error: "not configured" }, { status: 503 })
  const { data: begun, error: beginError } = await db.rpc("ingest_begin", { p_key: secret, p_trigger: trigger, p_force_dry: wantDry })
  if (beginError) {
    const busy = beginError.hint === "busy"
    return Response.json({ error: busy ? "Прогон уже идёт или был только что. Подождите пару минут." : "could not start" }, { status: busy ? 409 : 500 })
  }
  const { run_id: runId, live, sources } = (begun as { run_id: string; live: boolean; sources: Source[] }[])[0]

  const started = Date.now()
  const today = todayInAlmaty()
  const stats: Record<string, number> = { sources: sources.length, links: 0, fresh: 0, pages: 0, llm_calls: 0, cost_usd: 0 }
  const items: Report[] = []
  const count = (outcome: string) => (stats[outcome] = (stats[outcome] ?? 0) + 1)
  let fatal: string | null = null
  // The review queue is full or the run's insert limit is reached.
  let stopped = false

  async function handlePage(url: string, html: string, source: Source, report: Report) {
    if (!apiKey || !secret || !db) return
    const result = await extractOpportunity({ apiKey, page: pageText(html), url, today, kindHint: source.kind_hint, vocabulary, labels: CATEGORY_LABELS })
    if (result.usage) stats.cost_usd += result.usage.costUsd
    const item = "item" in result ? result.item : undefined
    Object.assign(report, item && { title: item.title, kind: item.kind, deadline: item.deadline, evidence: item.evidence, confidence: item.confidence })
    if (result.outcome !== "ok") {
      report.outcome = result.outcome
      report.reason = result.reason
      count(result.outcome)
      // Errors are retried tomorrow; everything else waits 30 days.
      if (live && result.outcome !== "error") {
        await db.rpc("ingest_mark_page", { p_key: secret, p_source: source.id, p_url: url, p_outcome: result.outcome })
      }
      return
    }
    if (!live) {
      report.outcome = "would_add"
      count("would_add")
      return
    }
    if (stopped) {
      report.outcome = "skipped"
      count("skipped")
      return
    }
    const { data: outcome, error: submitError } = await db.rpc("ingest_submit", {
      p_key: secret,
      p_run: runId,
      p_source: source.id,
      p_item: {
        ...result.item.filters,
        kind: result.item.kind,
        title: result.item.title,
        title_kk: result.item.title_kk,
        title_en: result.item.title_en,
        description: result.item.description,
        description_kk: result.item.description_kk,
        description_en: result.item.description_en,
        link: result.item.link,
        deadline: result.item.deadline,
        evidence: result.item.evidence,
        confidence: result.item.confidence,
        source_url: url,
        source_name: source.name,
      },
    })
    if (submitError) {
      const limit = submitError.hint === "queue_full" || submitError.hint === "run_limit"
      report.outcome = limit ? (submitError.hint as string) : "error"
      report.reason = submitError.hint ?? submitError.code
      count(report.outcome)
      if (limit) stopped = true
      return
    }
    report.outcome = outcome as string
    count(report.outcome)
  }

  try {
    for (const source of sources) {
      if (Date.now() - started > TIME_BUDGET_MS || stats.llm_calls >= MAX_LLM_CALLS || stopped) break
      const listing = new URL(source.listing_url)
      const robots = await loadRobots(listing)
      if (robots === "unavailable" || !robotsAllows(robots, listing)) {
        items.push({ url: source.listing_url, source: source.name, outcome: "blocked", reason: "robots.txt" })
        count("blocked")
        continue
      }
      let links: string[]
      try {
        const page = await fetchPage(source.listing_url, listing.hostname)
        links = matchingLinks(page.text, page.url, source.link_pattern, listing.hostname)
      } catch (error) {
        items.push({ url: source.listing_url, source: source.name, outcome: "error", reason: error instanceof Error ? error.message : "listing" })
        count("error")
        continue
      }
      stats.links += links.length
      const { data: seenRows } = await db.rpc("ingest_seen", { p_key: secret, p_urls: links.slice(0, 500) })
      const seen = new Set((seenRows as string[] | null) ?? [])
      const fresh = links.filter((l) => !seen.has(l)).slice(0, source.max_new_per_run)
      stats.fresh += fresh.length

      const inFlight = new Set<Promise<void>>()
      for (const url of fresh) {
        if (Date.now() - started > TIME_BUDGET_MS || stats.llm_calls >= MAX_LLM_CALLS) break
        const report: Report = { url, source: source.name, outcome: "error" }
        items.push(report)
        if (!robotsAllows(robots, new URL(url))) {
          report.outcome = "blocked"
          count("blocked")
          if (live) await db.rpc("ingest_mark_page", { p_key: secret, p_source: source.id, p_url: url, p_outcome: "blocked" })
          continue
        }
        await sleep(PAUSE_MS)
        let html: string
        try {
          const page = await fetchPage(url, listing.hostname)
          if (page.status >= 400 || !/html/i.test(page.contentType)) throw new Error(`status ${page.status}`)
          html = page.text
        } catch (error) {
          report.reason = error instanceof Error ? error.message : "fetch"
          count("error")
          continue
        }
        stats.pages++
        stats.llm_calls++
        const task = handlePage(url, html, source, report).finally(() => inFlight.delete(task))
        inFlight.add(task)
        if (inFlight.size >= PARALLEL) await Promise.race(inFlight)
      }
      await Promise.all(inFlight)
      if (stopped) break
    }
  } catch (error) {
    fatal = error instanceof Error ? error.message : "failed"
  }

  stats.cost_usd = Math.round(stats.cost_usd * 10000) / 10000
  stats.ms = Date.now() - started
  await db.rpc("ingest_finish", { p_key: secret, p_run: runId, p_stats: stats, p_items: items.slice(0, 200), p_error: fatal })
  return Response.json({ run: runId, mode: live ? "live" : "dry", stats, error: fatal })
}

export async function GET(request: Request) {
  return run(request, false)
}

/** Admin's "Запустить сейчас"; { dry: true } forces a dry run even when live. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { dry?: unknown }
  return run(request, body.dry === true)
}
