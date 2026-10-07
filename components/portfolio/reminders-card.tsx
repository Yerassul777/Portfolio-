"use client"

import { useState } from "react"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { haptic } from "@/lib/app-mode"
import { useConsents } from "@/lib/consent"
import { usePush } from "@/lib/push"

/** Deadline reminders for the favorites, by push, on this device. */
export function RemindersCard() {
  const { t } = useI18n()
  const push = usePush()
  const { record } = useConsents()
  const [failed, setFailed] = useState(false)

  if (push.state === "loading") return null

  const note =
    push.state === "install"
      ? t.reminders.install
      : push.state === "denied"
        ? t.reminders.denied
        : push.state === "unsupported"
          ? t.reminders.unsupported
          : push.state === "on"
            ? t.reminders.on
            : t.reminders.pushText

  return (
    <section aria-labelledby="reminders-title" className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 id="reminders-title" className="flex items-center gap-2 text-sm font-semibold text-white">
            {push.state === "on" ? (
              <Bell aria-hidden="true" className="h-4 w-4 text-emerald-400" />
            ) : (
              <BellOff aria-hidden="true" className="h-4 w-4 text-gray-400" />
            )}
            {t.reminders.pushTitle}
          </h3>
          <p className="text-xs leading-relaxed text-gray-400">{note}</p>
        </div>
        {(push.state === "off" || push.state === "on") && (
          <Button
            variant={push.state === "on" ? "outline" : "default"}
            disabled={push.busy}
            className="h-11 shrink-0"
            onClick={async () => {
              setFailed(false)
              haptic()
              try {
                if (push.state === "on") {
                  await push.disable()
                  await record("push", false).catch(() => {})
                } else {
                  await push.enable()
                  await record("push", true).catch(() => {})
                }
              } catch {
                setFailed(true)
              }
            }}
          >
            {push.busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {push.state === "on" ? t.reminders.disable : t.reminders.enable}
          </Button>
        )}
      </div>
      {failed && (
        <p role="alert" className="text-xs text-red-300">
          {t.reminders.failed}
        </p>
      )}
    </section>
  )
}
