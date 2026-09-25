import { createClient } from "@supabase/supabase-js"
import {
  CATEGORY_LABELS,
  FILTER_CONFIGS,
  getFilterLabel,
  type Category,
  type Opportunity,
} from "@/lib/types"
import { matchesSearch, searchTokens } from "@/lib/search"

const MODEL = "gpt-4o-mini"
const MAX_TOKENS = 700

// Cost guards. Every request is bounded, so a single caller cannot turn one
// message into an unbounded bill. Phase 1 replaces the IP limit with a
// per-account daily quota in the `ai_usage` table.
const MAX_HISTORY_MESSAGES = 12
const MAX_MESSAGE_CHARS = 2000
const MAX_NOTES_CONTEXT_CHARS = 4000
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
// Each round is one more OpenAI call; after the last one the model must answer.
const MAX_TOOL_ROUNDS = 3
const MAX_SEARCH_RESULTS = 8
const MAX_DESCRIPTION_CHARS = 300

type Bucket = { count: number; resetAt: number }

/**
 * Best-effort in-memory limiter. On serverless each instance keeps its own
 * counters, so this throttles casual abuse rather than a distributed attack.
 * The hard ceilings are the spend limit in the OpenAI dashboard and the
 * AI_ASSISTANT_DISABLED kill switch below.
 */
const buckets = new Map<string, Bucket>()

function rateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now()

  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k)
    }
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, retryAfter: 0 }
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { allowed: true, retryAfter: 0 }
}

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

type IncomingMessage = { role: "user" | "assistant"; content: string }

function normalizeMessages(input: unknown): IncomingMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null

  const recent = input.slice(-MAX_HISTORY_MESSAGES)
  const messages: IncomingMessage[] = []

  for (const item of recent) {
    if (typeof item !== "object" || item === null) return null
    const { role, content } = item as Record<string, unknown>
    if (role !== "user" && role !== "assistant") return null
    if (typeof content !== "string" || content.length === 0) return null
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) })
  }

  return messages.length > 0 ? messages : null
}

// ---------------------------------------------------------------------------
// Catalogue search tool
// ---------------------------------------------------------------------------

const CATEGORIES = Object.keys(FILTER_CONFIGS) as Category[]

/**
 * The tool schema is generated from FILTER_CONFIGS: every filter becomes a
 * nullable enum of exactly the values the UI knows, so the model cannot send a
 * value that would match nothing. Keys shared by several categories get the
 * union of their values; the handler re-checks them per category.
 */
function buildSearchTool() {
  const values = new Map<string, Set<string>>()
  const usedIn = new Map<string, { label: string; categories: string[] }>()

  for (const category of CATEGORIES) {
    for (const config of FILTER_CONFIGS[category]) {
      const key = config.key as string
      if (!values.has(key)) values.set(key, new Set())
      for (const option of config.options) values.get(key)!.add(option.value)
      const info = usedIn.get(key) ?? { label: config.label, categories: [] }
      info.categories.push(category)
      usedIn.set(key, info)
    }
  }

  const filterProperties: Record<string, unknown> = {}
  for (const [key, allowed] of values) {
    const info = usedIn.get(key)!
    const description = `${info.label}. Применимо к категориям: ${info.categories.join(", ")}. null — не фильтровать.`
    filterProperties[key] =
      key === "grant_available"
        ? { type: ["boolean", "null"], description }
        : { type: ["string", "null"], enum: [...allowed, null], description }
  }

  return {
    type: "function",
    function: {
      name: "search_opportunities",
      description:
        "Поиск возможностей в каталоге Portfolio+. Выбери категорию, при необходимости задай фильтры и ключевые слова. Неиспользуемые параметры — null.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: CATEGORIES,
            description: CATEGORIES.map((c) => `${c} — ${CATEGORY_LABELS[c]}`).join("; "),
          },
          query: {
            type: ["string", "null"],
            description:
              "Ключевые слова, которых нет среди фильтров: название, организатор, тема. Не повторяй здесь то, что уже задано фильтром или категорией (например, не пиши «хакатон», если задан type=hackathon). null — без текстового поиска.",
          },
          ...filterProperties,
        },
        required: ["category", "query", ...Object.keys(filterProperties)],
        additionalProperties: false,
      },
    },
  }
}

const SEARCH_TOOL = buildSearchTool()

// Read-only access through the publishable key: RLS exposes the catalogue to
// it and nothing else. The AI path never needs the service-role key.
function getCatalogClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function todayInAlmaty(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Almaty" })
}

type DeadlineStatus = "открыт" | "завершён" | "без дедлайна"

function deadlineStatus(deadline: string | null, today: string): DeadlineStatus {
  const match = deadline?.match(/^\d{4}-\d{2}-\d{2}/)
  if (!match) return "без дедлайна"
  return match[0] < today ? "завершён" : "открыт"
}

const STATUS_ORDER: Record<DeadlineStatus, number> = { "открыт": 0, "без дедлайна": 1, "завершён": 2 }

async function searchOpportunities(args: Record<string, unknown>) {
  const category = args.category as Category
  if (!CATEGORIES.includes(category)) {
    return { error: "Неизвестная категория" }
  }

  const client = getCatalogClient()
  if (!client) {
    console.error("Catalogue search unavailable: SUPABASE_PUBLISHABLE_KEY is not set")
    return { error: "Каталог временно недоступен" }
  }

  let request = client.from(category).select("*").order("created_at", { ascending: false }).limit(200)

  const applied: string[] = []
  const ignored: string[] = []
  const configs = FILTER_CONFIGS[category]

  for (const [key, raw] of Object.entries(args)) {
    if (key === "category" || key === "query" || raw === null || raw === undefined) continue
    const config = configs.find((c) => c.key === key)

    if (!config) {
      ignored.push(key)
      continue
    }

    if (key === "grant_available") {
      if (typeof raw === "boolean") {
        request = request.eq(key, raw)
        applied.push(`${config.label}: ${raw ? "есть" : "нет"}`)
      }
      continue
    }

    if (typeof raw === "string" && config.options.some((o) => o.value === raw)) {
      request = request.eq(key, raw)
      applied.push(`${config.label}: ${getFilterLabel(category, key, raw)}`)
    } else {
      ignored.push(key)
    }
  }

  const { data, error } = await request
  if (error) {
    console.error("Catalogue search error:", error)
    return { error: "Каталог временно недоступен" }
  }

  const tokens = typeof args.query === "string" ? searchTokens(args.query) : []
  const today = todayInAlmaty()

  const matches = (data as Opportunity[])
    .filter((opp) => matchesSearch(opp, category, tokens))
    .map((opp) => {
      const details: Record<string, string> = {}
      for (const config of configs) {
        const value = opp[config.key]
        if (typeof value === "string" && value) {
          details[config.label] = getFilterLabel(category, config.key as string, value)
        } else if (typeof value === "boolean" && config.key === "grant_available") {
          details[config.label] = value ? "есть" : "нет"
        }
      }
      return {
        title: opp.title,
        description:
          opp.description.length > MAX_DESCRIPTION_CHARS
            ? `${opp.description.slice(0, MAX_DESCRIPTION_CHARS)}…`
            : opp.description,
        link: opp.link,
        deadline: opp.deadline,
        status: deadlineStatus(opp.deadline, today),
        details,
      }
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  return {
    category: CATEGORY_LABELS[category],
    applied_filters: applied,
    ...(ignored.length > 0 && { ignored_filters_not_applicable: ignored }),
    total_found: matches.length,
    results: matches.slice(0, MAX_SEARCH_RESULTS),
  }
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } }

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string }

type AssistantReply = { content: string | null; tool_calls?: ToolCall[] }

async function callOpenAI(
  apiKey: string,
  messages: ChatMessage[],
  toolChoice: "auto" | "none"
): Promise<AssistantReply | null> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: [SEARCH_TOOL],
      tool_choice: toolChoice,
      // Strict schemas are only guaranteed for one call at a time.
      parallel_tool_calls: false,
      temperature: 0.7,
      max_tokens: MAX_TOKENS,
    }),
  })

  if (!response.ok) {
    console.error("OpenAI API error:", response.status, await response.text())
    return null
  }

  const data = await response.json()
  return data.choices?.[0]?.message ?? null
}

async function runToolCall(call: ToolCall) {
  if (call.function?.name !== "search_opportunities") {
    return { error: "Неизвестный инструмент" }
  }
  let args: Record<string, unknown>
  try {
    args = JSON.parse(call.function.arguments)
  } catch {
    return { error: "Некорректные параметры поиска" }
  }
  try {
    return await searchOpportunities(args)
  } catch (error) {
    console.error("Catalogue search failed:", error)
    return { error: "Каталог временно недоступен" }
  }
}

function buildSystemPrompt(notesContext: string): string {
  return `Ты — ИИ-помощник платформы Portfolio+ для казахстанских школьников и студентов. Сегодня ${todayInAlmaty()}.
Ты помогаешь выбирать олимпиады, соревнования, волонтёрские программы и университеты в Казахстане, развивать портфолио, готовиться к ЕНТ и выбирать карьерный путь.

У тебя есть инструмент search_opportunities — поиск по каталогу Portfolio+.
- Когда пользователь ищет возможности или просит что-то подобрать, сначала вызови search_opportunities и рекомендуй только то, что он вернул.
- Никогда не выдумывай олимпиады, конкурсы, даты и ссылки. Если в каталоге ничего не нашлось, честно скажи об этом и предложи изменить запрос: другой предмет, город или формат.
- Для каждой рекомендованной возможности укажи название, дедлайн и ссылку. Возможности со статусом «завершён» не предлагай как актуальные.
- Если пользователь спрашивает о своих целях или портфолио, опирайся на его заметки.

Отвечай на языке пользователя (по умолчанию — на русском), кратко и по делу. Пиши простым текстом без Markdown: без звёздочек, решёток и квадратных скобок. Ссылки давай обычным адресом.

${notesContext ? `Заметки пользователя:\n${notesContext}` : "У пользователя пока нет заметок."}`
}

const UNAVAILABLE = "ИИ-помощник временно недоступен. Попробуйте позже."
const FAILED = "Не удалось получить ответ. Попробуйте ещё раз."

export async function POST(req: Request) {
  try {
    if (process.env.AI_ASSISTANT_DISABLED === "true") {
      return Response.json({ error: UNAVAILABLE }, { status: 503 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY")
      return Response.json({ error: UNAVAILABLE }, { status: 503 })
    }

    const { allowed, retryAfter } = rateLimit(clientKey(req))
    if (!allowed) {
      return Response.json(
        { error: "Слишком много запросов. Попробуйте через час." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      )
    }

    const body = await req.json()
    const messages = normalizeMessages(body?.messages)
    if (!messages) {
      return Response.json({ error: "Invalid messages" }, { status: 400 })
    }

    const notesContext =
      typeof body?.notesContext === "string"
        ? body.notesContext.slice(0, MAX_NOTES_CONTEXT_CHARS)
        : ""

    const conversation: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(notesContext) },
      ...messages,
    ]

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const toolsAllowed = round < MAX_TOOL_ROUNDS
      const reply = await callOpenAI(apiKey, conversation, toolsAllowed ? "auto" : "none")
      if (!reply) {
        return Response.json({ error: FAILED }, { status: 502 })
      }

      if (!toolsAllowed || !reply.tool_calls?.length) {
        return Response.json({
          message: reply.content || "Извините, я не смог сгенерировать ответ.",
        })
      }

      conversation.push({ role: "assistant", content: reply.content, tool_calls: reply.tool_calls })
      for (const call of reply.tool_calls) {
        const result = await runToolCall(call)
        conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) })
      }
    }

    return Response.json({ error: FAILED }, { status: 502 })
  } catch (error) {
    console.error("AI assistant error:", error)
    return Response.json({ error: FAILED }, { status: 500 })
  }
}
