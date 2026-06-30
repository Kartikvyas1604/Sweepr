"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="font-mono text-[11px] uppercase tracking-widest text-ink-muted"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          className={cn(
            "h-10 w-full rounded-md border px-3.5 py-2",
            "font-mono text-sm text-ink placeholder:text-ink-muted/40",
            "transition-colors duration-200",
            "focus:outline-none focus:ring-1",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            error
              ? "border-accent/60 bg-accent/5 focus:border-accent focus:ring-accent/20"
              : "border-hairline bg-elevated/30 focus:border-accent/50 focus:ring-accent/20",
            className,
          )}
          {...props}
        />
        {error && (
          <p className="font-mono text-[10px] text-accent">{error}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
export type { InputProps };
