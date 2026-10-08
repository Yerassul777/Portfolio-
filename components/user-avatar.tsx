"use client"

import { cn } from "@/lib/utils"

/** Background of the avatar, by Profile.avatarColor (0–7). */
export const AVATAR_GRADIENTS = [
  "from-emerald-400 to-green-600",
  "from-sky-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-pink-400 to-rose-600",
  "from-amber-300 to-orange-500",
  "from-teal-300 to-cyan-600",
  "from-lime-300 to-emerald-600",
  "from-slate-400 to-slate-600",
]

/** A circle with the first letter of the name; no photos, nothing uploaded. */
export function UserAvatar({ name, color, className }: { name: string; color: number; className?: string }) {
  const letter = Array.from(name.trim())[0]?.toUpperCase() ?? "?"
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-lg shadow-black/20",
        AVATAR_GRADIENTS[color] ?? AVATAR_GRADIENTS[0],
        className
      )}
    >
      {letter}
    </span>
  )
}
