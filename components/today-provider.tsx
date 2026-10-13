"use client"

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react"
import { todayInAlmaty } from "@/lib/deadline"

// "Today" (YYYY-MM-DD, Almaty) for everything a page counts from it: days to a
// deadline, the footer's year. Hydration uses the day the server rendered the
// page on, then the browser's own: a page rendered yesterday — the app opens
// its home page from the offline copy (public/sw.js), or it was just before
// midnight — hydrates without a mismatch and shows today's numbers right after.

const ServerToday = createContext<string | null>(null)

export function TodayProvider({ today, children }: { today: string; children: ReactNode }) {
  return <ServerToday value={today}>{children}</ServerToday>
}

// Read for every card on a render: worked out at most once a minute.
let cached = ""
let until = 0
function clientToday(): string {
  const now = Date.now()
  if (now >= until) {
    cached = todayInAlmaty()
    until = now + 60_000
  }
  return cached
}

const subscribe = () => () => {}

export function useToday(): string {
  const server = useContext(ServerToday)
  return useSyncExternalStore(subscribe, clientToday, () => server ?? clientToday())
}
