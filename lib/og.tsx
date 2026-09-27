import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

export const OG_SIZE = { width: 1200, height: 630 }

// Geist with Cyrillic, bundled as TTF: the OG renderer cannot read woff2.
const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Geist-Bold.ttf")),
]).then(([regular, bold]) => [
  { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
  { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
])

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

interface OgCardProps {
  eyebrow: string
  title: string
  footer?: string
  site: string
}

/** The 1200×630 card shown when a link is shared in a messenger. */
export async function renderOgCard({ eyebrow, title, footer, site }: OgCardProps) {
  const text = clip(title, 110)
  const titleSize = text.length > 70 ? 56 : text.length > 40 ? 68 : 84

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0a0f0d 0%, #0d1a14 55%, #0f2a1d 100%)",
          color: "#f0fdf4",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg, #10b981, #16a34a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
              color: "white",
            }}
          >
            P+
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{site}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 22px",
              borderRadius: 999,
              border: "2px solid rgba(52, 211, 153, 0.35)",
              background: "rgba(52, 211, 153, 0.12)",
              color: "#6ee7b7",
              fontSize: 28,
            }}
          >
            {eyebrow}
          </div>
          <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1 }}>{text}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#9ca3af" }}>
          <div>{footer ?? ""}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts }
  )
}
