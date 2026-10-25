import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/loading-skeletons";

export default function Loading() {
  return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
    <SkeletonRegion label="กำลังตรวจสอบร้านและคำเชิญของคุณ" className="space-y-6">
      <div className="flex justify-between gap-4"><Skeleton className="h-8 w-28" /><Skeleton className="h-10 w-24" /></div>
      <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div>
      {[0, 1].map((item) => <div key={item} className="space-y-4 rounded-xl border bg-card p-5">
        <Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-24" />
        <div className="flex justify-end gap-2"><Skeleton className="h-11 w-20" /><Skeleton className="h-11 w-28" /></div>
      </div>)}
    </SkeletonRegion>
  </main>;
}
