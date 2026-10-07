import path from "node:path"
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

// The portfolio as an A4 PDF, rendered on the server: an installed iPhone app
// cannot print, and a client-side PDF library would cost hundreds of KB.

const FONT_DIR = path.join(process.cwd(), "assets", "fonts")
let fontsRegistered = false
function registerFonts() {
  if (fontsRegistered) return
  Font.register({
    family: "Geist",
    fonts: [
      { src: path.join(FONT_DIR, "Geist-Regular.ttf") },
      { src: path.join(FONT_DIR, "Geist-Bold.ttf"), fontWeight: 700 },
    ],
  })
  // Long words wrap instead of hyphenating with Latin rules.
  Font.registerHyphenationCallback((word) => [word])
  fontsRegistered = true
}

export interface PdfEntry {
  title: string
  kind: string
  status: "participating" | "completed"
  result: string
  organizer: string
  date: string | null
  description: string
}

export interface PdfLabels {
  heading: string
  completed: string
  participating: string
  generated: string
  empty: string
}

const EMERALD = "#059669"
const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Geist", fontSize: 10.5, color: "#111827", lineHeight: 1.45 },
  brand: { fontSize: 9, color: EMERALD, letterSpacing: 1, marginBottom: 6 },
  heading: { fontSize: 24, fontWeight: 700 },
  name: { fontSize: 14, marginTop: 4, color: "#374151" },
  rule: { height: 2, backgroundColor: EMERALD, marginTop: 14, marginBottom: 18, width: 64 },
  section: { fontSize: 11, fontWeight: 700, color: EMERALD, marginTop: 10, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 },
  entry: { marginBottom: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#d1fae5" },
  title: { fontSize: 12, fontWeight: 700 },
  meta: { fontSize: 9.5, color: "#4b5563", marginTop: 2 },
  result: { fontWeight: 700, color: "#92400e" },
  description: { marginTop: 4, color: "#374151" },
  empty: { color: "#6b7280" },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8.5, color: "#9ca3af", flexDirection: "row", justifyContent: "space-between" },
})

function Entry({ entry }: { entry: PdfEntry }) {
  const meta = [entry.kind, entry.date, entry.organizer].filter(Boolean).join(" · ")
  return (
    <View style={styles.entry} wrap={false}>
      <Text style={styles.title}>{entry.title}</Text>
      <Text style={styles.meta}>
        {entry.result ? <Text style={styles.result}>{entry.result}</Text> : null}
        {entry.result && meta ? " · " : ""}
        {meta}
      </Text>
      {entry.description ? <Text style={styles.description}>{entry.description}</Text> : null}
    </View>
  )
}

export async function renderPortfolioPdf(name: string, entries: PdfEntry[], labels: PdfLabels): Promise<Buffer> {
  registerFonts()
  const completed = entries.filter((e) => e.status === "completed")
  const participating = entries.filter((e) => e.status === "participating")
  const doc = (
    // No author or creator in the file's metadata.
    <Document title={labels.heading} creator="" producer="Portfolio+">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>PORTFOLIO+</Text>
        <Text style={styles.heading}>{labels.heading}</Text>
        {name ? <Text style={styles.name}>{name}</Text> : null}
        <View style={styles.rule} />

        {completed.length === 0 && participating.length === 0 && <Text style={styles.empty}>{labels.empty}</Text>}
        {completed.length > 0 && <Text style={styles.section}>{labels.completed}</Text>}
        {completed.map((entry, i) => (
          <Entry key={`c${i}`} entry={entry} />
        ))}
        {participating.length > 0 && <Text style={styles.section}>{labels.participating}</Text>}
        {participating.map((entry, i) => (
          <Entry key={`p${i}`} entry={entry} />
        ))}

        <View style={styles.footer} fixed>
          <Text>{labels.generated}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
  return renderToBuffer(doc)
}
