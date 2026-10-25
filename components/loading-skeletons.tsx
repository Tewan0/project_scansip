import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonRegion({ label, className, children }: {
  label: string; className?: string; children: ReactNode;
}) {
  return <div role="status">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className={className}>{children}</div>
  </div>;
}

export function OrderCardsSkeleton({ billing = false }: { billing?: boolean }) {
  return <SkeletonRegion label={billing ? "กำลังโหลดบิล" : "กำลังโหลดออเดอร์"}
    className={billing ? "grid gap-4 lg:grid-cols-2" : "grid gap-4 lg:grid-cols-2 xl:grid-cols-3"}>
    {Array.from({ length: billing ? 2 : 3 }, (_, item) => <div key={item} className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4"><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-20 rounded-full" /></div>
      <div className="space-y-2"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-3 w-28" /></div>
      {billing && <div className="space-y-3 rounded-lg border p-3">
        {[0, 1, 2].map((line) => <div key={line} className="flex justify-between gap-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-16" /></div>)}
      </div>}
      <div className="space-y-4">{[0, 1].map((line) => <div key={line} className="space-y-3 border-t pt-4">
        <Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between gap-3"><Skeleton className="h-5 w-20" /><Skeleton className="h-9 w-24 rounded-lg" /></div>
      </div>)}</div>
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>)}
  </SkeletonRegion>;
}

export function ServiceRequestsSkeleton() {
  return <SkeletonRegion label="กำลังโหลดคำขอจากลูกค้า" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {[0, 1, 2].map((item) => <div key={item} className="space-y-3 rounded-xl border p-4">
      <div className="flex justify-between gap-3"><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-16" /></div>
      <Skeleton className="h-3 w-16" /><Skeleton className="h-11 w-full rounded-lg" />
    </div>)}
  </SkeletonRegion>;
}

export function CustomerOrdersSkeleton() {
  return <SkeletonRegion label="กำลังโหลดประวัติออเดอร์ของโต๊ะ" className="space-y-3">
    {[0, 1].map((item) => <div key={item} className="space-y-3 rounded-lg border p-3">
      <div className="flex justify-between gap-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-16" /></div>
      <Skeleton className="h-3 w-2/3" />
    </div>)}
  </SkeletonRegion>;
}

export function TableCardsSkeleton() {
  return <SkeletonRegion label="กำลังโหลดผังโต๊ะ" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {[0, 1, 2, 3].map((item) => <div key={item} className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><Skeleton className="h-5 w-16" /></div><Skeleton className="h-5 w-16" /></div>
      <div className="space-y-2 px-4 pb-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
      <div className="border-t bg-muted/30 p-3"><Skeleton className="h-11 w-full rounded-lg" /></div>
    </div>)}
  </SkeletonRegion>;
}
