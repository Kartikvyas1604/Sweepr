"use client";

import { cn } from "@/lib/utils";
import { WalletButton } from "./wallet-button";
import { ArrowLeft, Menu } from "lucide-react";
import { useRouter } from "next/navigation";

interface TopNavProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  right?: React.ReactNode;
  className?: string;
}

function TopNav({
  title = "Sweepr",
  showBack,
  backHref,
  right,
  className,
}: TopNavProps) {
  const router = useRouter();

  return (
    <nav
      className={cn(
        "relative z-10 flex h-12 items-center border-b border-hairline bg-base/80 backdrop-blur-sm px-4",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => (backHref ? router.push(backHref) : router.back())}
              className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          {!showBack && (
            <button
              className="text-ink-muted/40 hover:text-ink-muted"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
        </div>

        <span className="font-display text-sm uppercase tracking-widest text-ink">
          {title}
        </span>

        <div className="flex items-center gap-3">
          {right || <WalletButton />}
        </div>
      </div>
    </nav>
  );
}

export { TopNav };
