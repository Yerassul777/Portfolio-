"use client"

import { useEffect, useState } from "react"
import { Download, Share, SquarePlus } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { promptInstall, startPwa, useInstallState } from "@/lib/pwa"

/** Registers the service worker; rendered once, in the root layout. */
export function PwaSetup() {
  useEffect(() => {
    startPwa()
  }, [])
  return null
}

/**
 * "Install the app", in the footer. Shown only where installing is possible
 * and not done yet: a one-tap prompt on Android and desktop Chrome/Edge, and
 * the two Share-menu steps on iPhone and iPad, which have no prompt.
 */
export function InstallAppButton() {
  const { t } = useI18n()
  const state = useInstallState()
  const [showSteps, setShowSteps] = useState(false)

  if (state === "none") return null

  return (
    <div className="flex flex-col items-center gap-3 md:items-end">
      <button
        type="button"
        aria-expanded={state === "ios" ? showSteps : undefined}
        onClick={() => (state === "prompt" ? void promptInstall() : setShowSteps((v) => !v))}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 text-sm font-medium text-emerald-300 transition-[transform,background-color] hover:bg-emerald-500/20 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        {t.install.button}
      </button>
      {state === "ios" && showSteps && (
        <ol className="space-y-2 rounded-xl border border-emerald-500/15 bg-[#0d1a14] p-4 text-left text-sm text-gray-300">
          <li className="flex items-center gap-2">
            <Share aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-400" />
            {t.install.iosStep1}
          </li>
          <li className="flex items-center gap-2">
            <SquarePlus aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-400" />
            {t.install.iosStep2}
          </li>
        </ol>
      )}
    </div>
  )
}
