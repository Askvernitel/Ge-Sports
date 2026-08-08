import type { CSSProperties } from 'react';

/** Shimmering placeholder block — border-radius 0 like everything else here. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function RoomCardSkeleton() {
  return (
    <div className="bg-panel border border-lichen flex flex-col">
      <Skeleton className="h-[150px] w-full" />
      <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full mt-2" />
      </div>
    </div>
  );
}
