type Bucket = { count: number; resetAt: number }

/**
 * Best-effort in-memory limiter: at most `max` calls per key in `windowMs`.
 * On serverless each instance keeps its own counters, so this throttles
 * casual abuse rather than a distributed attack; the hard ceilings live
 * elsewhere (the database, the provider's spend limit).
 */
export function createRateLimit(max: number, windowMs: number) {
  const buckets = new Map<string, Bucket>()

  return function rateLimit(key: string): { allowed: boolean; retryAfter: number } {
    const now = Date.now()

    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k)
      }
    }

    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return { allowed: true, retryAfter: 0 }
    }

    if (bucket.count >= max) {
      return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
    }

    bucket.count += 1
    return { allowed: true, retryAfter: 0 }
  }
}

/** The caller's address, as Vercel's proxy reports it. Used as a key, never stored. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}
