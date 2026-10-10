import { checkAiAccess, describeProfile, safetyIdentifier } from "@/lib/ai-access"
import { searchCatalogue } from "@/lib/catalogue"
import { DEFAULT_LOCALE, isEnabledLocale, type Locale } from "@/lib/i18n/config"
import { isDeadlinePassed, todayInAlmaty } from "@/lib/deadline"
import { createPublicClient } from "@/lib/supabase-server"
import { CATEGORY_LABELS, getFilterLabel, FILTER_CONFIGS, type Opportunity } from "@/lib/types"
import { writePlan, type PlanCandidate, type PlanEntry } from "@/lib/trajectory-plan"

// "Моя траектория": builds (or rebuilds) the plan for a goal and saves it as
// the user, so RLS and the goal/step limits apply. One plan costs one message
// of the assistant's daily allowance.

export const maxDuration = 60

const MAX_BODY_BYTES = 8_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const FAILED = "Не получилось построить план. Попробуйте ещё раз."
const json = (body: unknown, status = 200) => Response.json(body, { status })

function describe(opp: Opportunity): string {
  const parts: string[] = []
  for (const config of FILTER_CONFIGS[opp.kind]) {
    const value = opp[config.key]
    if (typeof value === "string" && value) parts.push(`${config.label}: ${getFilterLabel(opp.kind, config.key as string, value)}`)
  }
  return parts.join(", ").slice(0, 200)
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (process.env.AI_ASSISTANT_DISABLED === "true" || !apiKey) return json({ error: "ИИ временно недоступен.", code: "disabled" }, 503)
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "Слишком длинный запрос.", code: "too_large" }, 413)

  const access = await checkAiAccess(req, "строить траекторию")
  if (!access.ok) return access.response
  const { supabase, userId, profile } = access

  let body: { goal?: unknown; targetMonth?: unknown; goalId?: unknown; locale?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid request", code: "bad_request" }, 400)
  }
  const locale: Locale = typeof body.locale === "string" && isEnabledLocale(body.locale) ? body.locale : DEFAULT_LOCALE
  const goal = typeof body.goal === "string" ? body.goal.replace(/\s+/g, " ").trim().slice(0, 200) : ""
  if (goal.length < 3) return json({ error: "Опишите цель хотя бы в нескольких словах.", code: "bad_goal" }, 400)
  const today = todayInAlmaty()
  const targetMonth =
    typeof body.targetMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.targetMonth) && body.targetMonth >= today.slice(0, 7) && body.targetMonth <= "2040-12"
      ? body.targetMonth
      : null
  const goalId = typeof body.goalId === "string" && UUID.test(body.goalId) ? body.goalId : null

  if (goalId) {
    const { data: existing } = await supabase.from("goals").select("id").eq("id", goalId).maybeSingle()
    if (!existing) return json({ error: "Цель не найдена.", code: "not_found" }, 404)
  } else {
    const { count } = await supabase.from("goals").select("id", { count: "exact", head: true })
    if ((count ?? 0) >= 5) return json({ error: "Можно вести до 5 целей. Удалите одну, чтобы добавить новую.", code: "goal_limit" }, 409)
  }

  const { data: quotaRows, error: quotaError } = await supabase.rpc("consume_ai_message")
  if (quotaError) {
    if (quotaError.hint === "too_fast") return json({ error: "Подождите пару секунд.", code: "too_fast" }, 429)
    if (quotaError.hint === "global_budget") return json({ error: "ИИ на сегодня перегружен. Попробуйте завтра.", code: "global_budget" }, 503)
    console.error("Trajectory quota failed:", quotaError.code)
    return json({ error: FAILED, code: "failed" }, 500)
  }
  const quotaRow = (quotaRows as { allowed: boolean; used: number; daily_limit: number }[] | null)?.[0]
  const quota = quotaRow ? { used: quotaRow.used, limit: quotaRow.daily_limit } : null
  if (!quotaRow?.allowed) return json({ error: "Лимит ИИ на сегодня исчерпан — возвращайтесь завтра.", code: "quota", quota }, 429)

  // What the plan can stand on: the portfolio and the open catalogue, nearest
  // deadlines first. (The model picks what fits the goal; a keyword search
  // would need every word of the goal to match.)
  const pub = createPublicClient()
  const [{ data: entryRows }, open] = await Promise.all([
    supabase.from("portfolio_entries").select("status, kind, title, result, event_date").order("event_date", { ascending: false, nullsFirst: false }).limit(40),
    pub ? searchCatalogue(pub, { locale, onlyOpen: true, sort: "deadline", limit: 60 }).catch(() => [] as Opportunity[]) : Promise.resolve([] as Opportunity[]),
  ])
  const candidates: PlanCandidate[] = open
    .filter((opp) => !opp.deadline || !isDeadlinePassed(opp.deadline))
    .map((opp) => ({ id: opp.id, title: opp.title.slice(0, 160), kind: CATEGORY_LABELS[opp.kind], deadline: opp.deadline, details: describe(opp) }))
  const entries: PlanEntry[] = ((entryRows ?? []) as { status: string; kind: string; title: string; result: string; event_date: string | null }[]).map((e) => ({
    status: e.status,
    kind: e.kind,
    title: e.title.slice(0, 160),
    result: e.result.slice(0, 80),
    eventDate: e.event_date,
  }))

  const plan = await writePlan({
    apiKey,
    safetyIdentifier: safetyIdentifier(userId, apiKey),
    today,
    goal,
    targetMonth,
    profile: describeProfile(profile),
    entries,
    candidates,
    language: locale,
  })
  if (plan.usage) {
    const { error } = await supabase.rpc("record_ai_usage", {
      p_input_tokens: Math.min(plan.usage.input, 60000),
      p_output_tokens: Math.min(plan.usage.output, 3000),
      p_cost_usd: Math.min(plan.usage.costUsd, 0.05),
    })
    if (error) console.error("Recording trajectory usage failed:", error.code)
  }
  if (!plan.ok) {
    console.error("Trajectory failed:", plan.reason)
    return json({ error: FAILED, code: "failed", quota }, 502)
  }

  const goalRow = { title: goal, target_month: targetMonth ? `${targetMonth}-01` : null, summary: plan.summary }
  let id = goalId
  if (id) {
    const [{ error: updateError }, { error: deleteError }] = await Promise.all([
      supabase.from("goals").update(goalRow).eq("id", id),
      supabase.from("goal_steps").delete().eq("goal_id", id),
    ])
    if (updateError || deleteError) {
      console.error("Trajectory save failed:", (updateError ?? deleteError)?.code)
      return json({ error: FAILED, code: "failed", quota }, 500)
    }
  } else {
    const { data: created, error: insertError } = await supabase.from("goals").insert(goalRow).select("id").single()
    if (insertError || !created) {
      if (insertError?.hint === "goal_limit") return json({ error: "Можно вести до 5 целей.", code: "goal_limit", quota }, 409)
      console.error("Trajectory save failed:", insertError?.code)
      return json({ error: FAILED, code: "failed", quota }, 500)
    }
    id = (created as { id: string }).id
  }
  const { error: stepsError } = await supabase.from("goal_steps").insert(plan.steps.map((step) => ({ ...step, goal_id: id })))
  if (stepsError) {
    console.error("Trajectory steps failed:", stepsError.code)
    return json({ error: FAILED, code: "failed", quota }, 500)
  }
  return json({ goalId: id, quota })
}
