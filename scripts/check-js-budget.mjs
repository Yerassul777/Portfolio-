// Fails if a page's initial JavaScript is over budget.
//
// "Initial" = every script the server-rendered HTML references, gzipped,
// except <script noModule> (legacy polyfills that modern browsers never
// fetch). Code loaded later on purpose (supabase-js when the browser is idle,
// the AI and notes panels on demand) is not counted: Lighthouse cannot tell
// the two apart, which is why this check exists next to it.
//
// Usage: node scripts/check-js-budget.mjs [base-url] [budget-kb] [path...]
import { gzipSync } from "node:zlib"

const base = process.argv[2] ?? "http://localhost:3100"
const budgetKb = Number(process.argv[3] ?? 200)
const paths = process.argv.slice(4).length ? process.argv.slice(4) : ["/ru", "/ru/competitions"]

let failed = false
for (const path of paths) {
  const html = await (await fetch(base + path)).text()
  const legacy = new Set(
    [...html.matchAll(/<script\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((tag) => /\bnomodule\b/i.test(tag))
      .map((tag) => tag.match(/\bsrc="([^"]+)"/)?.[1])
      .filter(Boolean)
  )
  const scripts = [...new Set([...html.matchAll(/\/_next\/static\/[^"\\]+\.js/g)].map((m) => m[0]))].filter(
    (src) => !legacy.has(src)
  )
  let bytes = 0
  for (const src of scripts) {
    const body = Buffer.from(await (await fetch(base + src)).arrayBuffer())
    bytes += gzipSync(body).length
  }
  const kb = Math.round(bytes / 1024)
  const ok = kb <= budgetKb
  if (!ok) failed = true
  console.log(`${ok ? "ok  " : "OVER"} ${path}: ${kb} KB of initial JavaScript (gzip), budget ${budgetKb} KB, ${scripts.length} files`)
}
process.exit(failed ? 1 : 0)
