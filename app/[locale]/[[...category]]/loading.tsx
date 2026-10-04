import { Skeleton } from "@/components/ui/skeleton"
import { CatalogueSkeleton } from "@/components/catalogue-skeleton"

// Shown while navigating to the catalogue from another page (e.g. back from an
// opportunity page). Switching category or filters inside the catalogue never
// shows it: those updates happen in place.
export default function CatalogueLoading() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-busy="true">
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="mx-auto h-8 w-64 rounded-full" />
        <Skeleton className="mx-auto h-12 w-full max-w-xl" />
        <Skeleton className="mx-auto h-5 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl sm:h-12" />
      <CatalogueSkeleton />
    </div>
  )
}
