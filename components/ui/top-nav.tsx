"use client";

import { cn } from "@/lib/utils";
import { WalletButton } from "./wallet-button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface TopNavProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  right?: React.ReactNode;
  className?: string;
  onLogoClick?: () => void;
}

function TopNav({
  title = "Sweepr",
  showBack,
  backHref,
  right,
  className,
  onLogoClick,
}: TopNavProps) {
  const router = useRouter();

  return (
    <nav
      className={cn(
        "relative z-10 flex h-12 items-center border-b border bg-background/80 backdrop-blur-sm px-4",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <div className="flex w-24 items-center gap-3">
          {showBack ? (
            <button
              onClick={() => (backHref ? router.push(backHref) : router.back())}
              className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          ) : onLogoClick ? (
            <button
              onClick={onLogoClick}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <span className="font-display text-sm uppercase tracking-widest text-foreground">
                {title}
              </span>
            </button>
          ) : (
            <span className="font-display text-sm uppercase tracking-widest text-foreground">
              {title}
            </span>
          )}
        </div>

        <div className="flex w-24 items-center justify-end gap-3">
          {right || <WalletButton />}
        </div>
      </div>
    </nav>
  );
}

export { TopNav };
