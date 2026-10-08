"use client"

import useSWR from "swr"
import { getAccessToken } from "@/components/auth-provider"
import { loadSupabase } from "@/lib/supabase-browser"
import type { EntryKind } from "@/lib/portfolio"

// Certificate photos: a private Storage bucket, one folder per user
// (migration 20261008100000). Photos are re-encoded in the browser before
// they leave the device: smaller, and without EXIF (GPS, camera, time).

const BUCKET = "certificates"
/** Long edge of the stored photo, px: sharp enough to read a certificate. */
const MAX_EDGE = 1600
const QUALITY = 0.82
/** Signed URLs live this long; the list asks for new ones before that. */
const URL_SECONDS = 3600

/** Decodes any photo the browser can read and draws it again as a plain JPEG. */
export async function preparePhoto(file: Blob): Promise<Blob> {
  const source = await decode(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height))
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas")
  ctx.fillStyle = "#fff" // transparent PNGs become white, not black
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source.image, 0, 0, width, height)
  if ("close" in source.image) source.image.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY))
  if (!blob) throw new Error("encode")
  return blob
}

async function decode(file: Blob): Promise<{ image: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies the EXIF rotation before the EXIF is dropped.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
      return { image: bitmap, width: bitmap.width, height: bitmap.height }
    } catch {}
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { image: img, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadPhoto(userId: string, photo: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await (await loadSupabase()).storage.from(BUCKET).upload(path, photo, { contentType: "image/jpeg", upsert: false })
  if (error) throw error
  return path
}

export async function removePhotos(paths: string[]) {
  if (paths.length === 0) return
  const { error } = await (await loadSupabase()).storage.from(BUCKET).remove(paths)
  if (error) throw error
}

/** Every photo of the user, before the account is deleted (files are not rows: nothing cascades). */
export async function removeAllPhotos(userId: string) {
  const supabase = await loadSupabase()
  const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 1000 })
  if (error) throw error
  await removePhotos((data ?? []).map((file) => `${userId}/${file.name}`))
}

/** Short-lived links to show the photos; only the owner gets them. */
export function usePhotoUrls(paths: string[]): Record<string, string> {
  const sorted = [...new Set(paths)].sort()
  const { data } = useSWR(
    sorted.length > 0 ? (["cert-urls", ...sorted] as const) : null,
    async () => {
      const { data: signed, error } = await (await loadSupabase()).storage.from(BUCKET).createSignedUrls(sorted, URL_SECONDS)
      if (error) throw error
      const urls: Record<string, string> = {}
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl
      return urls
    },
    { revalidateOnFocus: false, refreshInterval: (URL_SECONDS - 300) * 1000 }
  )
  return data ?? {}
}

export type ScannedFields = {
  title: string
  organizer: string
  result: string
  eventDate: string | null
  kind: EntryKind
}

export type ScanOutcome =
  | { ok: true; fields: ScannedFields; quota: { used: number; limit: number } | null }
  | { ok: false; code: string; message: string; quota?: { used: number; limit: number } }

/** Reads the certificate's fields on the server (OpenAI); the photo is not kept there. */
export async function scanPhoto(photo: Blob): Promise<ScanOutcome> {
  const token = await getAccessToken()
  if (!token) return { ok: false, code: "auth_required", message: "" }
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(photo)
  })
  const response = await fetch("/api/certificates/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, code: data.code ?? "failed", message: data.error ?? "", quota: data.quota }
  return { ok: true, fields: data.fields, quota: data.quota ?? null }
}
