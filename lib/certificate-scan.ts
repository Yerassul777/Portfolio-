// Reading a certificate photo with OpenAI (server only; used by
// app/api/certificates/scan). No imports, so it can also be run on its own
// against the real model (the scanner's check script).
//
// Names, schools, dates of birth and ID numbers are not asked for and are
// scrubbed from the answer: the entry describes the achievement, not the person.

export const SCAN_MODEL = "gpt-4o-mini"
const OPENAI_TIMEOUT_MS = 25_000
// gpt-4o-mini, USD per token (image tokens are counted as input).
const PRICE_INPUT = 0.15 / 1_000_000
const PRICE_OUTPUT = 0.6 / 1_000_000

export const SCAN_KINDS = ["olympiads", "competitions", "volunteering", "universities", "other"] as const
export type ScanKind = (typeof SCAN_KINDS)[number]

export type CertificateFields = { title: string; organizer: string; result: string; eventDate: string | null; kind: ScanKind }

const SCHEMA = {
  name: "certificate",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["is_certificate", "title", "organizer", "result", "event_date", "kind"],
    properties: {
      is_certificate: { type: "boolean", description: "Это грамота, диплом, сертификат или благодарственное письмо" },
      title: { type: ["string", "null"], description: "За что награда: название олимпиады, конкурса, программы, например «Республиканская олимпиада по физике». Не вид документа и не имя человека." },
      organizer: { type: ["string", "null"], description: "Кто выдал: организация, министерство, вуз, фонд" },
      result: { type: ["string", "null"], description: "Результат как в документе: «Диплом II степени», «1 место», «Призёр», «Участник», «Волонтёр»" },
      event_date: { type: ["string", "null"], description: "Дата мероприятия или выдачи в формате YYYY-MM-DD; если день неизвестен — первое число месяца" },
      kind: { type: "string", enum: [...SCAN_KINDS] },
    },
  },
} as const

const PROMPT = `Ты читаешь фотографию грамоты, диплома или сертификата казахстанского школьника и заполняешь запись портфолио.
Верни только поля схемы. Пиши на языке документа (русский или казахский), без кавычек-ёлочек вокруг названий.
title — это мероприятие, за которое выдан документ («за участие в …», «победителю …»), записанное как название: «Республиканская олимпиада по физике», «Городской хакатон Astana Hub».
Слова «Диплом», «Грамота», «Сертификат», «Благодарственное письмо» и степень — не название: вид документа со степенью или местом пиши в result, например «Диплом II степени».
Никогда не выписывай фамилию, имя или отчество награждённого, название его школы, класс, дату рождения, ИИН, адрес и телефон — даже если они есть на фото.
Если поле не видно или не читается — null. Не угадывай.
kind: olympiads — олимпиады; competitions — конкурсы, соревнования, хакатоны, турниры; volunteering — волонтёрство; universities — поступление, университетские программы; other — всё остальное.
Если на фото не документ о достижении — is_certificate: false и остальные поля null.`

// An ID number (ИИН, 12 digits) or a phone must never reach the entry, whatever the model returned.
const SCRUB = /\b\d{12}\b|\+?\d[\d\s()-]{9,}\d/g

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  return value.replace(SCRUB, "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max)
}

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
  return value >= "1990-01-01" && value <= "2100-12-31" ? value : null
}

/** A JPEG or WebP data URL, decoded, within the size limit; else null. */
export function checkImage(image: string, maxBytes: number): Buffer | null {
  const match = /^data:image\/(jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image)
  if (!match) return null
  const bytes = Buffer.from(match[2], "base64")
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
  return bytes.length <= maxBytes && (isJpeg || isWebp) ? bytes : null
}

export type ScanUsage = { input: number; output: number; costUsd: number }

export type ScanResult =
  | { kind: "fields"; fields: CertificateFields; usage: ScanUsage }
  | { kind: "not_certificate" | "unreadable"; usage: ScanUsage }
  | { kind: "failed"; reason: string; usage: ScanUsage | null }

export async function readCertificate(image: string, apiKey: string, safetyIdentifier: string): Promise<ScanResult> {
  let response: Response
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      body: JSON.stringify({
        model: SCAN_MODEL,
        max_tokens: 300,
        temperature: 0,
        store: false,
        safety_identifier: safetyIdentifier,
        response_format: { type: "json_schema", json_schema: SCHEMA },
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: [{ type: "image_url", image_url: { url: image, detail: "high" } }] },
        ],
      }),
    })
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.name : "network", usage: null }
  }
  if (!response.ok) return { kind: "failed", reason: `upstream ${response.status}`, usage: null }

  const data = await response.json()
  const input = data.usage?.prompt_tokens ?? 0
  const output = data.usage?.completion_tokens ?? 0
  const usage = { input, output, costUsd: Number((input * PRICE_INPUT + output * PRICE_OUTPUT).toFixed(6)) }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}")
  } catch {
    return { kind: "failed", reason: "bad json", usage }
  }
  if (parsed.is_certificate !== true) return { kind: "not_certificate", usage }
  const fields: CertificateFields = {
    title: clean(parsed.title, 200),
    organizer: clean(parsed.organizer, 200),
    result: clean(parsed.result, 200),
    eventDate: cleanDate(parsed.event_date),
    kind: SCAN_KINDS.includes(parsed.kind as ScanKind) ? (parsed.kind as ScanKind) : "other",
  }
  if (!fields.title) return { kind: "unreadable", usage }
  return { kind: "fields", fields, usage }
}
