// An iCalendar file for one deadline: an all-day event with alerts at 09:00
// a week before and the day before. Calendar apps on iPhone, Android and
// desktop all import it, no account needed.
import type { Opportunity } from "@/lib/types"

/** RFC 5545 text: escape \ ; , and newlines. */
function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

/** Lines longer than 75 octets are folded (continuation lines start with a space). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ""
  let size = 0
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length
    if (size + charSize > (parts.length === 0 ? 75 : 74)) {
      parts.push(current)
      current = ""
      size = 0
    }
    current += char
    size += charSize
  }
  parts.push(current)
  return parts.join("\r\n ")
}

const compactDate = (date: string) => date.replace(/-/g, "")

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function deadlineCalendar(opportunity: Opportunity, pageUrl: string, labels: { summary: string; week: string; day: string }): string {
  if (!opportunity.deadline) throw new Error("no deadline")
  const date = opportunity.deadline.slice(0, 10)
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Portfolio+//Deadlines//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:deadline-${opportunity.id}@portfolio-plus`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(date)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(date))}`,
    `SUMMARY:${text(`${labels.summary}: ${opportunity.title}`)}`,
    `DESCRIPTION:${text(pageUrl)}`,
    `URL:${pageUrl}`,
    "TRANSP:TRANSPARENT",
    // All-day events start at 00:00: -6 days 15 h is 09:00 a week before.
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(labels.week)}`,
    "TRIGGER:-P6DT15H",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(labels.day)}`,
    "TRIGGER:-PT15H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.map(fold).join("\r\n") + "\r\n"
}
