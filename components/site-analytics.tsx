"use client"

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next"

/** Analytics gets the page, never its query string (sign-in codes, searches) or hash. */
function withoutQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url)
  url.search = ""
  url.hash = ""
  return { ...event, url: url.toString() }
}

export function SiteAnalytics() {
  return <Analytics beforeSend={withoutQuery} />
}
