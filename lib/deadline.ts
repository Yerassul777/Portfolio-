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

export function formatDeadline(deadline: string, month: "short" | "long" = "short"): string {
  const date = datePart(deadline)
  if (!date) return deadline
  // Midnight UTC formatted in UTC, so the printed day never shifts with the reader's time zone.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month,
    year: "numeric",
    timeZone: "UTC",
  })
}
