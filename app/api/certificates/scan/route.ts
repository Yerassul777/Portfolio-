import { checkAiAccess, safetyIdentifier } from "@/lib/ai-access"
import { checkImage, readCertificate } from "@/lib/certificate-scan"

// The certificate scanner: a photo in, the portfolio entry's fields out
// (lib/certificate-scan.ts). The photo goes to OpenAI for this one request
// (store: false) and is not kept here. Gates, in order: signed in, registered,
// 13 or older, agreed to scanning, within the day's allowance.

export const maxDuration = 30

// The browser sends a JPEG of at most 1600 px (lib/certificates.ts): a few
// hundred KB. Base64 adds a third.
const MAX_BODY_BYTES = 2_500_000
const MAX_IMAGE_BYTES = 1_800_000

const FAILED = "Не удалось распознать. Попробуйте ещё раз."
const json = (body: unknown, status = 200) => Response.json(body, { status })

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (process.env.AI_ASSISTANT_DISABLED === "true" || !apiKey) return json({ error: "Сканер временно недоступен.", code: "disabled" }, 503)

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "Фото слишком большое.", code: "too_large" }, 413)

  const access = await checkAiAccess(req, "сканировать сертификаты")
  if (!access.ok) return access.response
  const { supabase, userId, consents } = access
  if (!consents.get("certificate_scan")?.granted) return json({ error: "Сначала разрешите распознавание.", code: "scan_consent_required" }, 403)

  let image = ""
  try {
    const body = (await req.json()) as { image?: unknown }
    if (typeof body.image === "string") image = body.image
  } catch {
    return json({ error: "Invalid request", code: "bad_request" }, 400)
  }
  if (!checkImage(image, MAX_IMAGE_BYTES)) return json({ error: "Нужна фотография до 2 МБ.", code: "bad_image" }, 400)

  const { data: quotaRows, error: quotaError } = await supabase.rpc("consume_certificate_scan")
  if (quotaError) {
    if (quotaError.hint === "global_budget") return json({ error: "Сканер на сегодня перегружен. Попробуйте завтра.", code: "global_budget" }, 503)
    console.error("Scan quota failed:", quotaError.code)
    return json({ error: FAILED, code: "failed" }, 500)
  }
  const quotaRow = (quotaRows as { allowed: boolean; used: number; daily_limit: number }[] | null)?.[0]
  const quota = quotaRow ? { used: quotaRow.used, limit: quotaRow.daily_limit } : null
  if (!quotaRow?.allowed) return json({ error: "Лимит сканирований на сегодня исчерпан.", code: "quota", quota }, 429)

  const result = await readCertificate(image, apiKey, safetyIdentifier(userId, apiKey))

  if (result.usage) {
    const { error: usageError } = await supabase.rpc("record_scan_usage", {
      p_input_tokens: Math.min(result.usage.input, 60000),
      p_output_tokens: Math.min(result.usage.output, 1000),
      p_cost_usd: Math.min(result.usage.costUsd, 0.02),
    })
    if (usageError) console.error("Recording scan usage failed:", usageError.code)
  }

  switch (result.kind) {
    case "fields":
      return json({ fields: result.fields, quota })
    case "not_certificate":
      return json({ error: "Не похоже на грамоту или сертификат. Сфотографируйте документ целиком, при хорошем свете.", code: "not_certificate", quota }, 422)
    case "unreadable":
      return json({ error: "Не удалось прочитать название. Попробуйте сфотографировать ближе.", code: "unreadable", quota }, 422)
    default:
      console.error("Scan failed:", result.reason)
      return json({ error: FAILED, code: "failed", quota }, 502)
  }
}
