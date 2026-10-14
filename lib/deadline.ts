// Deadlines are calendar dates ("YYYY-MM-DD") in Kazakhstan. An opportunity
// stays open through its whole deadline day, Almaty time, wherever the reader is.

export function todayInAlmaty(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Almaty" })
}

function datePart(deadline: string | null | undefined): string | null {
  return deadline?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null
}

export function isDeadlinePassed(deadline: string | null | undefined, today = todayInAlmaty()): boolean {
  const date = datePart(deadline)
  return date !== null && date < today
}

/** Whole days from today to the deadline: 0 on the last day, negative once passed. */
export function daysUntil(deadline: string | null | undefined, today = todayInAlmaty()): number | null {
  const date = datePart(deadline)
  if (!date) return null
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

// Dates are spelled out here rather than by Intl, because the server and the
// browser must print exactly the same text or hydration fails. Intl does not
// guarantee that: Chromium has no Kazakh month names ("2027 M02 15" against
// the server's "2027 ж. 15 ақпан"), and Safari 16 puts other spaces into
// "15 февр. 2027 г." than the server does — the same to the eye, a hydration
// error on every start of the app on an iPad (found by lib/diagnostics.ts).
// Month names for a date with a day (Russian: genitive), and for a month alone.
const MONTHS: Record<"ru" | "en" | "kk", { long: string[]; short: string[]; alone: string[] }> = {
  ru: {
    long: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    short: ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."],
    alone: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  },
  en: {
    long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    alone: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
  kk: {
    long: ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
    short: ["қаң.", "ақп.", "нау.", "сәу.", "мам.", "мау.", "шіл.", "там.", "қыр.", "қаз.", "қар.", "жел."],
    alone: ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
  },
}

/**
 * A YYYY-MM-DD date in the reader's language (`lang` is a BCP 47 tag, e.g.
 * HTML_LANG[locale]): day, month, and the year unless `year` is false; with
 * `day: false`, month and year ("қараша 2026", "ноябрь 2026 г.", "November 2026").
 */
export function formatDate(date: string, lang: string, { month = "long", day = true, year = true }: { month?: "short" | "long"; day?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = date.split("-").map(Number)
  const language = lang.split("-")[0]
  const names = MONTHS[language === "en" || language === "kk" ? language : "ru"]
  if (!day) return `${names.alone[m - 1]} ${y}${names === MONTHS.ru ? " г." : ""}`
  const name = names[month][m - 1]
  if (language === "en") return year ? `${name} ${d}, ${y}` : `${name} ${d}`
  if (!year) return `${d} ${name}`
  return language === "kk" ? `${d} ${name} ${y} ж.` : `${d} ${name} ${y} г.`
}

export function formatDeadline(deadline: string, month: "short" | "long" = "short", lang = "ru"): string {
  const date = datePart(deadline)
  if (!date) return deadline
  return formatDate(date, lang, { month })
}
