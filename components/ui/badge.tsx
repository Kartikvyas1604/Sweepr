import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "live" | "money" | "success" | "elevated" | "outline";
  size?: "sm" | "md";
}

function Badge({
  className,
  variant = "default",
  size = "sm",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono font-medium tracking-wider uppercase",
        {
          sm: "h-5 px-2 text-[10px]",
          md: "h-6 px-2.5 text-[11px]",
        }[size],
        {
          default: "bg-elevated/50 text-ink-muted border border-hairline",
          live: "bg-accent/15 text-accent border border-accent/20",
          money: "bg-money/15 text-money border border-money/20",
          success: "bg-success/15 text-success border border-success/20",
          elevated: "bg-elevated text-ink-muted border border-hairline",
          outline: "border border-hairline text-ink-muted",
        }[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
export type { BadgeProps };
