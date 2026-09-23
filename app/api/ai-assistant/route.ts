const MODEL = "gpt-4o-mini"
const MAX_TOKENS = 500

// Cost guards. Every request is bounded, so a single caller cannot turn one
// message into an unbounded bill. Phase 1 replaces the IP limit with a
// per-account daily quota in the `ai_usage` table.
const MAX_HISTORY_MESSAGES = 12
const MAX_MESSAGE_CHARS = 2000
const MAX_NOTES_CONTEXT_CHARS = 4000
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

type Bucket = { count: number; resetAt: number }

/**
 * Best-effort in-memory limiter. On serverless each instance keeps its own
 * counters, so this throttles casual abuse rather than a distributed attack.
 * The hard ceilings are OPENAI_SPEND_LIMIT in the OpenAI dashboard and the
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

type IncomingMessage = { role: string; content: string }

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

export async function POST(req: Request) {
  try {
    if (process.env.AI_ASSISTANT_DISABLED === "true") {
      return Response.json(
        { error: "ИИ-помощник временно недоступен. Попробуйте позже." },
        { status: 503 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY")
      return Response.json(
        { error: "ИИ-помощник временно недоступен. Попробуйте позже." },
        { status: 503 }
      )
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

    const systemPrompt = `Ты — персональный ИИ-помощник для казахстанских школьников и студентов. 
Ты помогаешь с выбором олимпиад, соревнований, волонтёрских программ и университетов в Казахстане.
Ты даёшь советы по развитию портфолио, подготовке к экзаменам (ЕНТ), и выбору карьерного пути.
Отвечай на русском языке, кратко и по делу.

${notesContext ? `Вот заметки пользователя для контекста:\n${notesContext}` : "У пользователя пока нет заметок."}`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: MAX_TOKENS,
      }),
    })

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, await response.text())
      return Response.json(
        { error: "Не удалось получить ответ. Попробуйте ещё раз." },
        { status: 502 }
      )
    }

    const data = await response.json()
    const assistantMessage =
      data.choices?.[0]?.message?.content || "Извините, я не смог сгенерировать ответ."

    return Response.json({ message: assistantMessage })
  } catch (error) {
    console.error("AI assistant error:", error)
    return Response.json(
      { error: "Не удалось получить ответ. Попробуйте ещё раз." },
      { status: 500 }
    )
  }
}
