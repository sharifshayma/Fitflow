"use client";

import { format } from "date-fns";
import type { Goal, FoodLogWithValues } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FoodLogTableProps = {
  logs: FoodLogWithValues[];
  goals: Goal[];
  onDelete: (id: string) => void;
  onCopy: (log: FoodLogWithValues) => void;
  onEdit: (log: FoodLogWithValues) => void;
};

export function FoodLogTable({ logs, goals, onDelete, onCopy, onEdit }: FoodLogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <p className="text-lg font-medium">No food logged for this day</p>
        <p className="text-sm mt-1">Tap the + button to log your first meal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card key={log.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{log.food_name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(log.logged_at), "h:mm a")}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {log.food_log_values.map((val) => {
                  const goal = goals.find((g) => g.id === val.goal_id);
                  if (!goal) return null;
                  return (
                    <span
                      key={val.id}
                      className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {goal.name}: {val.value} {goal.unit}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(log)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(log)}
              >
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(log.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
