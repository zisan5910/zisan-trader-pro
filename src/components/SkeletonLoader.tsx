import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => (
  <div className="animate-fade-in pb-4">
    <div className="bg-primary px-5 pt-6 pb-12 rounded-b-[2rem]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-xl bg-primary-foreground/15" />
          <div>
            <Skeleton className="h-5 w-32 bg-primary-foreground/15 mb-1" />
            <Skeleton className="h-3 w-24 bg-primary-foreground/10" />
          </div>
        </div>
        <Skeleton className="w-10 h-10 rounded-full bg-primary-foreground/10" />
      </div>
    </div>
    <div className="px-4 -mt-8 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {Array(8).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  </div>
);

export const ListSkeleton = ({ header = true }: { header?: boolean }) => (
  <div className="animate-fade-in">
    {header && (
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    )}
    <div className="p-4 space-y-3">
      {Array(5).fill(0).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

export const ReportSkeleton = () => (
  <div className="animate-fade-in">
    <div className="px-4 py-4 bg-card border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl mb-3" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {Array(6).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);
