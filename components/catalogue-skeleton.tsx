import { Skeleton } from "@/components/ui/skeleton"

// On its own, not in catalogue.tsx: loading.tsx renders it, and importing it
// from there put a second copy of the whole catalogue into the page's JavaScript.
export function CatalogueSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-64 rounded-xl" />
      ))}
    </div>
  )
}
