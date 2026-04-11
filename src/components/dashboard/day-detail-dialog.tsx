"use client";

import { useFoodLogs } from "@/lib/swr/use-food-logs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";

type DayDetailDialogProps = {
  goalId: string;
  goalName: string;
  goalUnit: string;
  date: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DayDetailDialog({
  goalId,
  goalName,
  goalUnit,
  date,
  open,
  onOpenChange,
}: DayDetailDialogProps) {
  const { logs, isLoading } = useFoodLogs(open ? date : "");

  const filtered = logs.filter((log) =>
    log.food_log_values.some((v) => v.goal_id === goalId && v.value > 0)
  );

  const total = filtered.reduce((sum, log) => {
    const val = log.food_log_values.find((v) => v.goal_id === goalId);
    return sum + (val?.value ?? 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goalName}</DialogTitle>
          <DialogDescription>
            {format(parseISO(date), "EEEE, MMMM d")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No entries</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((log) => {
              const val = log.food_log_values.find((v) => v.goal_id === goalId);
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{log.food_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(log.logged_at), "h:mm a")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {val ? Math.round(val.value * 10) / 10 : 0} {goalUnit}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t pt-2 mt-1">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-sm font-bold">
                {Math.round(total * 10) / 10} {goalUnit}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
