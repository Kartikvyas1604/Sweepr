"use client";

import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  label?: string;
  pulse?: boolean;
  className?: string;
}

function LiveIndicator({
  label = "LIVE",
  pulse = true,
  className,
}: LiveIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-live",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
      </span>
      {label}
    </div>
  );
}

export { LiveIndicator };
