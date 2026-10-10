"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, ImagePlus, Loader2, ScanText, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/components/i18n-provider"
import { preparePhoto, scanPhoto, type ScannedFields } from "@/lib/certificates"
import { useConsents } from "@/lib/consent"
import { format, plural } from "@/lib/i18n/format"
import { AI_MIN_AGE } from "@/lib/policy"
import { ageOn, todayInKazakhstan, useProfile } from "@/lib/profile"

/** The photo in the entry form: none, the one already saved, or a new one not uploaded yet. */
export type PhotoState = { kind: "none" } | { kind: "saved"; path: string } | { kind: "new"; blob: Blob }

type Status =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "ask" }
  | { kind: "scanning" }
  | { kind: "scanned"; left: number | null }
  | { kind: "error"; message: string }

/**
 * "Certificate" block of the entry form. Scanning fills the empty fields from
 * the photo (and keeps the photo on the entry); attaching only keeps the
 * photo. The first scan asks once whether the photo may go to OpenAI.
 */
export function CertificateField({
  photo,
  savedUrl,
  onPhoto,
  onScanned,
}: {
  photo: PhotoState
  savedUrl?: string
  onPhoto: (photo: PhotoState) => void
  onScanned: (fields: ScannedFields) => void
}) {
  const { locale, t } = useI18n()
  const { consents, record } = useConsents()
  const { profile } = useProfile()
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const cameraRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  const scanAfterPick = useRef(false)

  const tooYoung = profile?.birthDate ? ageOn(profile.birthDate, todayInKazakhstan()) < AI_MIN_AGE : consents.ageBracket === "under13"
  const preview = usePreview(photo.kind === "new" ? photo.blob : null)
  const shown = photo.kind === "new" ? preview : photo.kind === "saved" ? savedUrl : undefined

  const scan = async (blob: Blob) => {
    setStatus({ kind: "scanning" })
    const outcome = await scanPhoto(blob).catch(() => null)
    if (!outcome) return setStatus({ kind: "error", message: t.certificates.failed })
    if (!outcome.ok) return setStatus({ kind: "error", message: t.apiErrors[outcome.code] || outcome.message || t.certificates.failed })
    onScanned(outcome.fields)
    setStatus({ kind: "scanned", left: outcome.quota ? Math.max(0, outcome.quota.limit - outcome.quota.used) : null })
  }

  const take = async (file: File | undefined) => {
    if (!file) return
    setStatus({ kind: "preparing" })
    let blob: Blob
    try {
      blob = await preparePhoto(file)
    } catch {
      return setStatus({ kind: "error", message: t.certificates.unreadablePhoto })
    }
    onPhoto({ kind: "new", blob })
    if (!scanAfterPick.current || tooYoung) return setStatus({ kind: "idle" })
    if (!consents.certificateScan) return setStatus({ kind: "ask" })
    await scan(blob)
  }

  const open = (scanIt: boolean) => {
    scanAfterPick.current = scanIt
    ;(scanIt ? cameraRef : pickRef).current?.click()
  }

  const busy = status.kind === "preparing" || status.kind === "scanning"

  return (
    <div className="space-y-3 rounded-xl border border-gray-800 bg-[#0f1512] p-3">
      <p className="text-xs font-medium text-gray-300">{t.certificates.label}</p>
      {/* capture: on phones this opens the camera straight away; desktops get a file picker. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void take(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
      <input ref={pickRef} type="file" accept="image/*" className="hidden" onChange={(e) => void take(e.target.files?.[0]).finally(() => (e.target.value = ""))} />

      {shown && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a private, signed or local URL */}
          <img src={shown} alt={t.certificates.photoAlt} className="h-20 w-20 shrink-0 rounded-lg border border-gray-700 object-cover" />
          <div className="flex min-w-0 flex-wrap gap-2">
            {!tooYoung && photo.kind === "new" && status.kind !== "scanned" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="h-10 border-emerald-500/30 text-emerald-200"
                onClick={() => (consents.certificateScan ? void scan(photo.blob) : setStatus({ kind: "ask" }))}
              >
                <ScanText className="h-4 w-4" />
                {t.certificates.read}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" disabled={busy} className="h-10 text-gray-300" onClick={() => open(false)}>
              <ImagePlus className="h-4 w-4" />
              {t.certificates.replace}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              className="h-10 text-gray-400 hover:text-red-300"
              onClick={() => {
                onPhoto({ kind: "none" })
                setStatus({ kind: "idle" })
              }}
            >
              <Trash2 className="h-4 w-4" />
              {t.certificates.remove}
            </Button>
          </div>
        </div>
      )}

      {!shown && photo.kind !== "saved" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {!tooYoung && (
            <Button type="button" disabled={busy} onClick={() => open(true)} className="h-11 bg-gradient-to-r from-emerald-500 to-green-600 text-white">
              <Camera className="h-4 w-4" />
              {t.certificates.scan}
            </Button>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={() => open(false)} className="h-11 border-gray-700 text-gray-200">
            <ImagePlus className="h-4 w-4" />
            {t.certificates.attach}
          </Button>
        </div>
      )}

      {status.kind === "ask" && photo.kind === "new" && (
        <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-sm font-medium text-white">{t.certificates.consentTitle}</p>
          <p className="text-xs leading-relaxed text-gray-300">{t.certificates.consentText}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-10"
              onClick={async () => {
                try {
                  await record("certificate_scan", true)
                } catch {
                  return setStatus({ kind: "error", message: t.consent.saveFailed })
                }
                await scan(photo.blob)
              }}
            >
              <Sparkles className="h-4 w-4" />
              {t.certificates.allow}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-10 text-gray-300" onClick={() => setStatus({ kind: "idle" })}>
              {t.certificates.onlyPhoto}
            </Button>
          </div>
        </div>
      )}

      <div aria-live="polite" className="text-xs">
        {status.kind === "preparing" && (
          <span className="flex items-center gap-2 text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t.certificates.preparing}
          </span>
        )}
        {status.kind === "scanning" && (
          <span className="flex items-center gap-2 text-emerald-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t.certificates.scanning}
          </span>
        )}
        {status.kind === "scanned" && (
          <span className="text-emerald-300">
            {t.certificates.scanned}
            {status.left !== null && <span className="text-gray-400"> · {format(plural(locale, status.left, t.certificates.left), { n: status.left })}</span>}
          </span>
        )}
        {status.kind === "error" && (
          <span role="alert" className="text-amber-300">
            {status.message}
          </span>
        )}
        {status.kind === "idle" && !shown && (
          <span className="text-gray-500">{tooYoung ? t.certificates.hintYoung : t.certificates.hint}</span>
        )}
      </div>
    </div>
  )
}

/** An object URL for a blob, released when the blob changes or the form closes. */
function usePreview(blob: Blob | null): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  return url
}

/** The photo on an entry card; a tap shows it full size. */
export function CertificateThumb({ url, title }: { url: string | undefined; title: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  if (!url) return <span aria-hidden="true" className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-gray-800" />
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={format(t.certificates.view, { title })}
        className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-gray-700 transition-transform active:scale-95"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a private, signed URL */}
        <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t.details.close} className="w-[calc(100%-2rem)] max-w-3xl border-gray-800 bg-[#0d1210] p-3">
          <DialogTitle className="pr-8 text-sm text-white">{title}</DialogTitle>
          <DialogDescription className="sr-only">{t.certificates.photoAlt}</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element -- a private, signed URL */}
          <img src={url} alt={t.certificates.photoAlt} className="max-h-[75svh] w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}
