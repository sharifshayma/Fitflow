import { cn } from "@/lib/utils";
import type { GoalDirection } from "@/lib/validators";

type DayCellProps = {
  date: string;
  dayLabel: string;
  value: number | null;
  target: number;
  unit: string;
  direction: GoalDirection;
};

export function DayCell({ dayLabel, value, target, unit, direction }: DayCellProps) {
  const hasData = value !== null && value > 0;
  // max goals: red when over target. min goals: red when under target.
  const isOffTrack = hasData && (
    direction === "max" ? value > target : value < target
  );
  const percentage = hasData ? Math.min((value / target) * 100, 100) : 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl p-3 min-w-[4.5rem] transition-colors",
        !hasData && "bg-muted/50",
        hasData && !isOffTrack && "bg-emerald-50 border border-emerald-200",
        hasData && isOffTrack && "bg-red-50 border border-red-200"
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{dayLabel}</span>
      <span
        className={cn(
          "text-lg font-bold mt-1",
          !hasData && "text-muted-foreground/40",
          hasData && !isOffTrack && "text-emerald-700",
          hasData && isOffTrack && "text-red-700"
        )}
      >
        {hasData ? Math.round(value) : "-"}
      </span>
      <span className="text-[10px] text-muted-foreground">{unit}</span>
      {hasData && (
        <div className="w-full h-1 rounded-full bg-muted mt-1.5">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isOffTrack ? "bg-red-400" : "bg-emerald-400"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
