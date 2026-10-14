// Runs in the browser before React hydrates, so the first errors — a
// hydration mismatch among them — are already caught (lib/diagnostics.ts).
import { startDiagnostics } from "@/lib/diagnostics"

startDiagnostics()
