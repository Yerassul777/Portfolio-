// /.well-known/assetlinks.json (next.config.mjs rewrites it here): Android's
// proof that the Google Play app (a Trusted Web Activity) and this site have
// the same owner. Without it the app still opens, but with a browser bar on
// top. The package name and the SHA-256 fingerprint(s) of the signing key come
// from the environment (docs/stores.md); until they are set the list is empty.

const PACKAGE = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() ?? ""
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => FINGERPRINT.test(f))

  const statements =
    PACKAGE.test(packageName) && fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
          },
        ]
      : []

  return Response.json(statements, { headers: { "Cache-Control": "public, max-age=3600" } })
}
