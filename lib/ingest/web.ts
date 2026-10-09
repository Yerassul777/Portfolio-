import { lookup } from "node:dns/promises"

// The ingestion job's view of the web (server only, no "@/" imports so it can
// be tested on its own). It reads only what a polite, honest crawler would:
// https pages of the source's own site, never private or internal addresses,
// with a size and time limit, as "Portfolio+Bot" with a page explaining it,
// and only where robots.txt allows.

export const USER_AGENT = "Portfolio+Bot/1.0 (+https://kazakhstanportfolio.vercel.app/ru/bot; school research project)"
const ROBOTS_TOKEN = "portfolio+bot"
const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3

/** A host given as text that must never be fetched, whatever DNS says. */
function blockedHostname(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^[\d.]+$/.test(host) || // IPv4 literal
    host.includes(":") || // IPv6 literal
    !host.includes(".")
  )
}

function privateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase()
    if (v6.startsWith("::ffff:")) return privateAddress(v6.slice(7))
    return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80")
  }
  const [a, b] = ip.split(".").map(Number)
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  )
}

/**
 * The URL if the job may fetch it: https, default port, no credentials, a
 * public host name, and — when `siteHost` is given — that site or its
 * subdomains only.
 */
export function allowedUrl(raw: string, siteHost?: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null
  const host = url.hostname.toLowerCase()
  if (blockedHostname(host)) return null
  if (siteHost) {
    const site = siteHost.toLowerCase().replace(/^www\./, "")
    const bare = host.replace(/^www\./, "")
    if (bare !== site && !bare.endsWith(`.${site}`)) return null
  }
  url.hash = ""
  return url
}

async function resolvesPublic(host: string): Promise<boolean> {
  try {
    const addresses = await lookup(host, { all: true })
    return addresses.length > 0 && addresses.every((a) => !privateAddress(a.address))
  } catch {
    return false
  }
}

export type Fetched = { url: string; status: number; contentType: string; text: string }

/** GET with every guard: allowed URL, public address, manual redirects, size and time limits. */
export async function fetchPage(raw: string, siteHost: string, accept = "text/html"): Promise<Fetched> {
  let current = allowedUrl(raw, siteHost)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!current) throw new Error("url not allowed")
    if (!(await resolvesPublic(current.hostname))) throw new Error("host not public")
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: `${accept},*/*;q=0.1`, "Accept-Language": "ru,kk;q=0.8,en;q=0.5" },
    })
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location")
      current = next ? allowedUrl(new URL(next, current).toString(), siteHost) : null
      continue
    }
    const contentType = response.headers.get("content-type") ?? ""
    const declared = Number(response.headers.get("content-length") ?? 0)
    if (declared > MAX_BYTES) throw new Error("too large")
    const text = await readLimited(response, contentType)
    return { url: current.toString(), status: response.status, contentType, text }
  }
  throw new Error("too many redirects")
}

async function readLimited(response: Response, contentType: string): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      throw new Error("too large")
    }
    chunks.push(value)
  }
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8"
  let decoder: TextDecoder
  try {
    decoder = new TextDecoder(charset)
  } catch {
    decoder = new TextDecoder("utf-8")
  }
  const all = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    all.set(c, offset)
    offset += c.byteLength
  }
  return decoder.decode(all)
}

// --- robots.txt ---------------------------------------------------------------

type Rule = { allow: boolean; pattern: string }

/** The rules that apply to this bot: its own group if there is one, else "*". */
export function parseRobots(text: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = []
  let current: { agents: string[]; rules: Rule[] } | null = null
  let lastWasAgent = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim()
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line)
    if (!match) continue
    const field = match[1].toLowerCase()
    const value = match[2].trim()
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current) continue
    if (field === "allow" || field === "disallow") {
      if (field === "disallow" && value === "") continue // "Disallow:" allows everything
      current.rules.push({ allow: field === "allow", pattern: value })
    }
  }
  const own = groups.filter((g) => g.agents.some((a) => a !== "*" && ROBOTS_TOKEN.startsWith(a.replace(/\/.*$/, ""))))
  const chosen = own.length > 0 ? own : groups.filter((g) => g.agents.includes("*"))
  return chosen.flatMap((g) => g.rules)
}

function ruleMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$")
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path)
}

/** Longest matching rule wins; on a tie, allow. No rule: allowed. */
export function robotsAllows(rules: Rule[], url: URL): boolean {
  const path = url.pathname + url.search
  let best: Rule | null = null
  for (const rule of rules) {
    if (!rule.pattern || !ruleMatches(rule.pattern, path)) continue
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule
  }
  return !best || best.allow
}

/** robots.txt of a site; unreachable or missing means "no rules", a server error means "stay away". */
export async function loadRobots(siteUrl: URL): Promise<Rule[] | "unavailable"> {
  try {
    const robots = await fetchPage(`https://${siteUrl.host}/robots.txt`, siteUrl.hostname, "text/plain")
    if (robots.status >= 500) return "unavailable"
    if (robots.status >= 400) return []
    return parseRobots(robots.text)
  } catch {
    return "unavailable"
  }
}

// --- links on a listing page ---------------------------------------------------

/** Links on the page that match the source's pattern, absolute, without fragments, in page order. */
export function matchingLinks(html: string, base: string, pattern: string, siteHost: string, limit = 200): string[] {
  let re: RegExp
  try {
    re = new RegExp(pattern, "i")
  } catch {
    return []
  }
  const found: string[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/href\s*=\s*["']([^"'\s>]+)["']/gi)) {
    const href = m[1].replace(/&amp;/g, "&")
    let absolute: string
    try {
      absolute = new URL(href, base).toString()
    } catch {
      continue
    }
    const url = allowedUrl(absolute, siteHost)
    if (!url) continue
    const text = url.toString()
    let decoded = text
    try {
      decoded = decodeURI(text)
    } catch {}
    if (!re.test(text) && !re.test(decoded)) continue
    if (seen.has(text)) continue
    seen.add(text)
    found.push(text)
    if (found.length >= limit) break
  }
  return found
}
