import type { ReactNode } from "react"

/** Centered message with actions: 404, errors. Works in server and client components. */
export function StatusPage({ code, title, text, children }: { code: string; title: string; text: string; children: ReactNode }) {
  return (
    <div className="container mx-auto flex min-h-[60svh] max-w-xl flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <p className="bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-7xl font-bold text-transparent">{code}</p>
      <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground">{text}</p>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  )
}

export const statusButtonClass =
  "inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 text-sm font-medium text-white transition-all hover:from-emerald-600 hover:to-green-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40"

export const statusSecondaryClass =
  "inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:border-primary/50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
