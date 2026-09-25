import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-mono",
})

// Favicons come from the file conventions app/icon.svg and app/apple-icon.png,
// which Next.js links automatically — no explicit `icons` entry needed.
export const metadata: Metadata = {
  title: "Portfolio+ — возможности для школьников Казахстана",
  description:
    "Олимпиады, соревнования, волонтёрство и университеты Казахстана в одном месте. Найди возможность и прокачай своё портфолио.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
