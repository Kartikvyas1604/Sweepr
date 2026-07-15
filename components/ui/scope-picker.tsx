"use client";

import { cn } from "@/lib/utils";
import { Trophy, Swords, SlidersHorizontal } from "lucide-react";

type Scope = "all" | "single" | "custom";

interface ScopeOption {
  value: Scope;
  label: string;
  desc: string;
  icon: React.ElementType;
}

const OPTIONS: ScopeOption[] = [
  {
    value: "all",
    label: "All Matches",
    desc: "104 matches · 32 teams · classic sweepstakes",
    icon: Trophy,
  },
  {
    value: "single",
    label: "1 Match",
    desc: "Head-to-head · 2 teams · instant showdown",
    icon: Swords,
  },
  {
    value: "custom",
    label: "Custom",
    desc: "Pick your matches · choose the action",
    icon: SlidersHorizontal,
  },
];

interface ScopePickerProps {
  value: Scope;
  onChange: (scope: Scope) => void;
  disabled?: boolean;
}

export function ScopePicker({ value, onChange, disabled }: ScopePickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
        Pool Scope
      </p>
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center transition-all duration-200",
                isActive
                  ? "border-primary/50 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                  : "border bg-muted/30 text-muted-foreground/60 hover:border-foreground/30 hover:text-foreground/80",
                disabled && "opacity-40 pointer-events-none",
              )}
            >
              <Icon className="h-5 w-5" />
              <div>
                <p className="font-display text-xs uppercase tracking-wider">{opt.label}</p>
                <p className="mt-1 font-mono text-[9px] leading-tight text-muted-foreground/40">
                  {opt.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
