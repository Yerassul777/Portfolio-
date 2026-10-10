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

// Kazakh dates are spelled out here rather than by Intl: Chromium browsers
// ship without Kazakh month names and print "2027 M02 15", while the server
// (full ICU) prints "2027 ж. 15 ақпан" — different text on each side breaks
// hydration, and the browser's version is unreadable.
const KK_MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"]
const KK_MONTHS_SHORT = ["қаң.", "ақп.", "нау.", "сәу.", "мам.", "мау.", "шіл.", "там.", "қыр.", "қаз.", "қар.", "жел."]

/**
 * A YYYY-MM-DD date in the reader's language (`lang` is a BCP 47 tag, e.g.
 * HTML_LANG[locale]): day, month, and the year unless `year` is false; with
 * `day: false`, month and year ("қараша 2026", "ноябрь 2026 г.").
 */
export function formatDate(date: string, lang: string, { month = "long", day = true, year = true }: { month?: "short" | "long"; day?: boolean; year?: boolean } = {}): string {
  if (lang === "kk") {
    const [y, m, d] = date.split("-").map(Number)
    const name = (month === "short" ? KK_MONTHS_SHORT : KK_MONTHS)[m - 1]
    if (!day) return `${name} ${y}`
    return year ? `${d} ${name} ${y} ж.` : `${d} ${name}`
  }
  // Midnight UTC formatted in UTC, so the printed day never shifts with the reader's time zone.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(lang, {
    ...(day && { day: "numeric" }),
    month,
    ...(year && { year: "numeric" }),
    timeZone: "UTC",
  })
}

export function formatDeadline(deadline: string, month: "short" | "long" = "short", lang = "ru"): string {
  const date = datePart(deadline)
  if (!date) return deadline
  return formatDate(date, lang, { month })
}
