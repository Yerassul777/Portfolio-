// A quick regression run of the whole site in a real browser: pages in each
// language without errors, the catalogue, search, an opportunity, the
// installed app's launch to the end, the diagnostics' launch report, the API
// contracts (what each route answers without sign-in) and the service files.
// Uses the browser already on the machine (Edge or Chrome; BROWSER=<path> picks one).
//
// Usage: [BROWSER=<path>] node scripts/smoke.mjs [base-url]   (default http://localhost:3100)
import fs from "node:fs"
import puppeteer from "puppeteer-core"

const BASE = process.argv[2] ?? "http://localhost:3100"
const BROWSER = process.env.BROWSER ?? [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((path) => fs.existsSync(path))

let failures = 0
const check = (name, passed, detail = "") => {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${passed ? "" : `  ${JSON.stringify(detail).slice(0, 300)}`}`)
  if (!passed) failures++
}
const status = async (path, init) => (await fetch(BASE + path, { redirect: "manual", ...init })).status
const until = async (test, ms = 10_000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await test().catch(() => false)) return true
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return false
}

// --- service files and status codes -----------------------------------------------
for (const path of ["/ru", "/kz", "/en", "/ru/competitions", "/ru/privacy", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/sw.js", "/offline.html"]) {
  check(`${path} answers 200`, (await status(path)) === 200)
}
check("/ redirects to a language", [307, 308].includes(await status("/")))
check("an unknown page is a real 404", (await status("/ru/no-such-page-at-all")) === 404)
check("an unknown opportunity is a real 404", (await status("/ru/o/no-such-opportunity")) === 404)
const sitemap = await (await fetch(BASE + "/sitemap.xml")).text()
const opportunityPath = sitemap.match(/<loc>[^<]*?(\/ru\/o\/[^<]+)<\/loc>/)?.[1]
check("the sitemap lists opportunities", !!opportunityPath)

// --- API contracts without sign-in ------------------------------------------------------
// 401 where the route is set up; 503 where its keys are not (a local build without OpenAI or VAPID keys).
const refused = (code) => code === 401 || code === 503
let code = await status("/api/ai-assistant", { method: "POST", body: "{}", headers: { "content-type": "application/json" } })
check("AI assistant: nothing without sign-in", refused(code), code)
code = await status("/api/portfolio/pdf", { method: "POST", body: "{}" })
check("portfolio PDF: nothing without sign-in", refused(code), code)
code = await status("/api/cron/reminders")
check("reminders job: nothing without the cron secret", refused(code), code)
code = await status("/api/diag", { method: "POST", body: "not json" })
check("diagnostics: a malformed report is refused (400)", code === 400, code)
// An opportunity with a deadline: the home page lists the nearest ones.
const home = await (await fetch(`${BASE}/ru`)).text()
const slugs = [...new Set([...home.matchAll(/\/ru\/o\/([a-z0-9-]+)/g)].map((m) => m[1]))]
let calendar = null
for (const slug of slugs) {
  const response = await fetch(`${BASE}/api/ics/${slug}`)
  if (response.status === 200) {
    calendar = response.headers.get("content-type")
    break
  }
}
check("calendar file for an opportunity with a deadline", /text\/calendar/.test(calendar ?? ""), { slugs: slugs.length, calendar })

// --- in the browser --------------------------------------------------------------------
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true })
const IGNORED = /_vercel\/insights|Failed to load resource|beforeinstallprompt/

async function open(path, { app = false, setup } = {}) {
  const page = await (await browser.createBrowserContext()).newPage()
  const errors = []
  const reports = []
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 200)))
  page.on("console", (message) => message.type() === "error" && !IGNORED.test(message.text()) && errors.push(message.text().slice(0, 200)))
  await page.exposeFunction("__report", (body) => reports.push(...JSON.parse(body).reports))
  await page.evaluateOnNewDocument((app) => {
    const send = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = (url, data) => (String(url).endsWith("/api/diag") ? (data.text().then(window.__report), true) : send(url, data))
    if (app) Object.defineProperty(navigator, "standalone", { get: () => true })
  }, app)
  if (setup) await setup(page)
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await page.goto(BASE + path, { waitUntil: "networkidle2" })
  return { page, errors, reports }
}

for (const [path, words] of [
  ["/ru", "Найди свою"],
  ["/kz", "Өз мүмкіндігіңді"],
  ["/en", "Find your"],
  ["/ru/competitions", "Соревнования"],
  ["/ru/privacy", "Политика конфиденциальности"],
  ...(opportunityPath ? [[opportunityPath, ""]] : []),
]) {
  const { page, errors } = await open(path)
  const text = await page.evaluate(() => document.body.innerText)
  check(`${path}: renders${words ? ` "${words}"` : ""}, no errors`, text.includes(words) && errors.length === 0, errors)
  await page.browserContext().close()
}

{
  const { page, errors } = await open("/ru/universities?q=" + encodeURIComponent("университет"))
  const cards = await page.evaluate(() => document.querySelectorAll("main a[href*='/o/']").length)
  check("search finds opportunities", cards > 0 && errors.length === 0, { cards, errors })
  await page.browserContext().close()
}

{
  const { page, errors, reports } = await open("/ru", { app: true })
  check("app: the launch screen plays and lands", await until(() => page.evaluate(() => !document.documentElement.dataset.splash), 15_000))
  check("app: tab bar and header logo there", await page.evaluate(() => !!document.querySelector('nav[aria-label="Разделы приложения"]') && getComputedStyle(document.querySelector("[data-brand-logo] svg")).opacity === "1"))
  check("app: the start is reported to diagnostics", await until(async () => reports.some((r) => r.kind === "launch"), 5000), reports)
  check("app: no errors", errors.length === 0, errors)

  // The next start goes through the service worker, which says where the page came from.
  await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 10_000 }).catch(() => {})
  const again = await page.browserContext().newPage()
  const served = []
  await again.exposeFunction("__report", (body) => served.push(...JSON.parse(body).reports))
  await again.evaluateOnNewDocument(() => {
    navigator.sendBeacon = (url, data) => (String(url).endsWith("/api/diag") ? (data.text().then(window.__report), true) : false)
    Object.defineProperty(navigator, "standalone", { get: () => true })
  })
  await again.goto(BASE + "/ru", { waitUntil: "networkidle2" })
  await until(async () => served.some((r) => r.kind === "launch"), 15_000)
  const labels = served.find((r) => r.kind === "launch")?.report.navigation?.served ?? []
  check("app: the service worker labels the page it served", labels.some((label) => /^sw:(launch|network|offline)=/.test(label)) && labels.some((label) => /^sw-boot=\d+/.test(label)), labels)
  await page.browserContext().close()
}

{
  // Safari 16 prints other spaces in dates than the server: the page must still hydrate.
  const nbspDates = (page) =>
    page.evaluateOnNewDocument(() => {
      const format = Date.prototype.toLocaleDateString
      Date.prototype.toLocaleDateString = function (lang, options) {
        const text = format.call(this, lang, options)
        return String(lang).startsWith("ru") ? text.replace(/ /g, "\u00a0") : text
      }
    })
  const { page, errors } = await open("/ru", { setup: nbspDates })
  check("dates hydrate in a browser with other spaces (Safari 16)", errors.length === 0, errors)
  await page.browserContext().close()
}

await browser.close()
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED")
process.exit(failures ? 1 : 0)
