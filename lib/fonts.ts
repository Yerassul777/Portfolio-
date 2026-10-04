import { Geist } from "next/font/google"

// "optional", not the default "swap": the fallback's metrics are tuned on
// Latin text, and on Cyrillic a late swap re-wrapped the hero (one line of
// heading became two) and pushed everything below it down. With "optional"
// a font that is not there by first paint is not swapped in for that page
// view; it is in the HTTP and service-worker caches for every view after.
const geistSans = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
  display: "optional",
})

// Shared by the locale layout and global-not-found, which renders outside it.
export const fontClassName = geistSans.variable
