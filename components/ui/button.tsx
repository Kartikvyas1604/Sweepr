"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-display uppercase tracking-wider transition-all duration-200",
          "disabled:opacity-40 disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
          {
            primary:
              "bg-accent text-base hover:bg-accent/90 active:bg-accent/80 shadow-lg shadow-accent/20",
            secondary:
              "bg-elevated/50 text-ink hover:bg-elevated active:bg-elevated/80 border border-hairline",
            ghost:
              "text-ink-muted hover:text-ink hover:bg-elevated/30",
            outline:
              "border border-hairline text-ink hover:bg-elevated/30 hover:border-ink-muted/30",
          }[variant],
          {
            sm: "h-8 px-3 text-xs gap-1.5",
            md: "h-10 px-5 text-sm gap-2",
            lg: "h-12 px-8 text-base gap-2.5",
          }[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps };
