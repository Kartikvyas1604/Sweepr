"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Search, Check, Calendar } from "lucide-react";

interface FixtureOption {
  id: string;
  label: string;
  homeTeam: { id: string; name: string; flagUrl?: string };
  awayTeam: { id: string; name: string; flagUrl?: string };
  kickoff: string;
  stage: string;
  group: string | null;
  status: "scheduled" | "live" | "finished";
}

interface FixturePickerProps {
  fixtures: FixtureOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  disabled?: boolean;
  mode?: "single" | "multi";
}

export function FixturePicker({
  fixtures,
  selectedIds,
  onChange,
  max,
  disabled,
  mode = "multi",
}: FixturePickerProps) {
  const [search, setSearch] = useState("");
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const filtered = fixtures.filter(
      (f) =>
        f.status === "scheduled" &&
        (search === "" ||
          f.homeTeam.name.toLowerCase().includes(search.toLowerCase()) ||
          f.awayTeam.name.toLowerCase().includes(search.toLowerCase()) ||
          f.label.toLowerCase().includes(search.toLowerCase())),
    );

    const stageMap = new Map<string, FixtureOption[]>();
    for (const f of filtered) {
      const stage = f.stage || "Other";
      if (!stageMap.has(stage)) stageMap.set(stage, []);
      stageMap.get(stage)!.push(f);
    }

    return Array.from(stageMap.entries()).sort((a, b) => {
      const order = ["Group Stage", "Round of 16", "Quarterfinals", "Semifinals", "Final"];
      const ia = order.findIndex((s) => a[0].includes(s));
      const ib = order.findIndex((s) => b[0].includes(s));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [fixtures, search]);

  function toggle(id: string) {
    if (disabled) return;
    if (mode === "single") {
      onChange([id]);
      return;
    }
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      if (max && selectedIds.length >= max) return;
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          Select{mode === "single" ? " a" : " Matches"}
        </p>
        {mode === "multi" && (
          <span className="font-mono text-[10px] text-muted-foreground/40">
            {selectedIds.length}{max ? `/${max}` : ""} selected
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
        <input
          type="text"
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border bg-muted/30 pl-9 pr-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <div className="max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
        {grouped.length === 0 && (
          <p className="py-8 text-center font-mono text-[11px] text-muted-foreground/40">
            No matches found
          </p>
        )}

        {grouped.map(([stage, stageFixtures]) => {
          const isExpanded = expandedStage === stage || search !== "";
          return (
            <div key={stage} className="mb-2">
              <button
                type="button"
                onClick={() => setExpandedStage(isExpanded && search === "" ? null : stage)}
                className="flex w-full items-center justify-between px-1 py-1.5"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                  {stage}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground/30">
                  {stageFixtures.length}
                </span>
              </button>

              {isExpanded && (
                <div className="flex flex-col gap-1">
                  {stageFixtures.map((f) => {
                    const isSelected = selectedIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        disabled={disabled || (!isSelected && !!max && selectedIds.length >= max)}
                        onClick={() => toggle(f.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all",
                          isSelected
                            ? "border-primary/40 bg-primary/10"
                            : "border bg-muted/20 hover:border-foreground/20",
                          disabled && "opacity-40 pointer-events-none",
                        )}
                      >
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border">
                          {isSelected && <Check className="h-3 w-3 text-primary" />}
                        </div>
                        {f.homeTeam.flagUrl && (
                          <img src={f.homeTeam.flagUrl} alt="" className="h-3 w-5 rounded-sm object-cover" />
                        )}
                        <span className="font-display text-xs uppercase tracking-wider text-foreground">
                          {f.homeTeam.name}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground/30">vs</span>
                        <span className="font-display text-xs uppercase tracking-wider text-foreground">
                          {f.awayTeam.name}
                        </span>
                        {f.awayTeam.flagUrl && (
                          <img src={f.awayTeam.flagUrl} alt="" className="h-3 w-5 rounded-sm object-cover" />
                        )}
                        {f.group && (
                          <Badge variant="outline" size="sm" className="ml-auto shrink-0">
                            {f.group}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
