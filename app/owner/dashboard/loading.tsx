import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/loading-skeletons";

export default function Loading() {
  return <SkeletonRegion label="กำลังโหลดพื้นที่จัดการร้าน" className="min-h-screen bg-background">
    <div className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-8">
      <Skeleton className="h-10 w-40" /><Skeleton className="size-10 rounded-full" />
    </div>
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <div className="space-y-3"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-72" /></div>
      <div className="space-y-3 rounded-xl border bg-card p-5"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-56" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, item) => <div key={item} className="space-y-4 rounded-xl border bg-card p-5">
          <Skeleton className="size-11 rounded-xl" /><Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" />
        </div>)}
      </div>
    </div>
  </SkeletonRegion>;
}
