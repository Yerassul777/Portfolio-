import { Geist } from "next/font/google"

const geistSans = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
})

// Shared by the locale layout and global-not-found, which renders outside it.
export const fontClassName = geistSans.variable
