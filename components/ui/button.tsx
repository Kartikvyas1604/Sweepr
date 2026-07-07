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
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          {
            primary:
              "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-lg shadow-primary/20",
            secondary:
              "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/80",
            ghost:
              "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            outline:
              "border text-foreground hover:bg-muted/50",
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
