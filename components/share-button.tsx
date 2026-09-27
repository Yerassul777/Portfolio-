"use client"

import { useState } from "react"
import { Check, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"

/**
 * The system share sheet on touch devices, where it lists WhatsApp and
 * Telegram; a copied link on desktops, where the OS dialog gets in the way.
 */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")

  const share = async () => {
    const url = new URL(path, window.location.origin).toString()
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url })
        return
      } catch (error) {
        // The user closed the sheet: nothing to report.
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus("copied")
    } catch {
      setStatus("failed")
    }
    setTimeout(() => setStatus("idle"), 2500)
  }

  return (
    <Button type="button" variant="outline" onClick={share} className="h-12 gap-2 rounded-xl px-5">
      {status === "copied" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      <span aria-live="polite">
        {status === "copied" ? t.details.copied : status === "failed" ? t.details.copyFailed : t.details.share}
      </span>
    </Button>
  )
}
