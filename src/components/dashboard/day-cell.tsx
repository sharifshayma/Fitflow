import { cn } from "@/lib/utils";

type DayCellProps = {
  date: string;
  dayLabel: string;
  value: number | null;
  target: number;
  unit: string;
};

export function DayCell({ dayLabel, value, target, unit }: DayCellProps) {
  const hasData = value !== null && value > 0;
  const isOver = hasData && value > target;
  const percentage = hasData ? Math.min((value / target) * 100, 100) : 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl p-3 min-w-[4.5rem] transition-colors",
        !hasData && "bg-muted/50",
        hasData && !isOver && "bg-emerald-50 border border-emerald-200",
        hasData && isOver && "bg-red-50 border border-red-200"
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{dayLabel}</span>
      <span
        className={cn(
          "text-lg font-bold mt-1",
          !hasData && "text-muted-foreground/40",
          hasData && !isOver && "text-emerald-700",
          hasData && isOver && "text-red-700"
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
              isOver ? "bg-red-400" : "bg-emerald-400"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
