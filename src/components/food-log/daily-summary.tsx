import { cn } from "@/lib/utils";
import type { FoodLogWithValues, Goal } from "@/lib/validators";

type DailySummaryProps = {
  logs: FoodLogWithValues[];
  goals: Goal[];
};

export function DailySummary({ logs, goals }: DailySummaryProps) {
  if (goals.length === 0) return null;

  // Compute totals per goal
  const totals: Record<string, number> = {};
  for (const log of logs) {
    for (const val of log.food_log_values) {
      totals[val.goal_id] = (totals[val.goal_id] ?? 0) + val.value;
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {goals.map((goal) => {
        const current = totals[goal.id] ?? 0;
        const isOffTrack =
          goal.direction === "max"
            ? current > goal.target_value
            : current < goal.target_value;
        const hasData = current !== 0;

        return (
          <div
            key={goal.id}
            className={cn(
              "flex-shrink-0 rounded-lg px-3 py-1.5 text-xs border",
              !hasData && "bg-muted/50 border-transparent",
              hasData && !isOffTrack && "bg-emerald-50 border-emerald-200",
              hasData && isOffTrack && "bg-red-50 border-red-200"
            )}
          >
            <span className="font-medium">{goal.name}</span>
            <span className="text-muted-foreground ml-1">
              {goal.target_value % 1 !== 0 ? current.toFixed(1) : Math.round(current)}/{goal.target_value} {goal.unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
