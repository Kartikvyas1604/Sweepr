"use client";

import { cn } from "@/lib/utils";
import { Check, Lock } from "lucide-react";

interface TeamOption {
  teamId: string;
  teamName: string;
  flagUrl: string;
  group: string | null;
  isTaken: boolean;
  takenBy: string | null;
  fixture: {
    fixtureId: string;
    opponentName: string;
    kickoff: string;
    stage: string;
  } | null;
}

interface TeamPickerProps {
  teams: TeamOption[];
  selectedId: string | null;
  onChange: (teamId: string) => void;
  disabled?: boolean;
}

export function TeamPicker({ teams, selectedId, onChange, disabled }: TeamPickerProps) {
  const available = teams.filter((t) => !t.isTaken);
  const taken = teams.filter((t) => t.isTaken);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          Pick Your Team
        </p>
        <span className="font-mono text-[10px] text-muted-foreground/40">
          {available.length} available
        </span>
      </div>

      {available.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {available.map((team) => {
            const isSelected = selectedId === team.teamId;
            return (
              <button
                key={team.teamId}
                type="button"
                disabled={disabled}
                onClick={() => onChange(team.teamId)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-center transition-all duration-200",
                  isSelected
                    ? "border-primary/50 bg-primary/10 shadow-sm shadow-primary/10"
                    : "border bg-muted/20 hover:border-foreground/20 hover:bg-muted/30",
                  disabled && "opacity-40 pointer-events-none",
                )}
              >
                {team.flagUrl ? (
                  <img src={team.flagUrl} alt="" className="h-8 w-12 rounded-sm object-cover" />
                ) : (
                  <div className="flex h-8 w-12 items-center justify-center rounded-sm bg-muted/50 font-mono text-[10px] text-muted-foreground/40">
                    {team.teamName.slice(0, 3).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-display text-[11px] uppercase tracking-wider text-foreground">
                    {team.teamName}
                  </p>
                  {team.group && (
                    <p className="font-mono text-[9px] text-muted-foreground/40">
                      Group {team.group}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {taken.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30">
            Taken
          </p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
            {taken.map((team) => (
              <div
                key={team.teamId}
                className="flex items-center gap-2 rounded-md border border-dashed border-muted/40 bg-muted/10 px-2.5 py-2 opacity-50"
              >
                {team.flagUrl && (
                  <img src={team.flagUrl} alt="" className="h-3 w-5 rounded-sm object-cover grayscale" />
                )}
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50 truncate">
                  {team.teamName}
                </span>
                <Lock className="ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground/30" />
              </div>
            ))}
          </div>
        </div>
      )}

      {teams.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="font-mono text-[11px] text-muted-foreground/40">No teams available</p>
        </div>
      )}
    </div>
  );
}
