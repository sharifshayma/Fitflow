"use client";

import { format, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";

type DateNavigatorProps = {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  canGoNext: boolean;
};

export function DateNavigator({ weekStart, onPrev, onNext, canGoNext }: DateNavigatorProps) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm" onClick={onPrev}>
        &larr; Prev
      </Button>
      <span className="text-sm font-medium text-muted-foreground">
        {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
      </span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!canGoNext}>
        Next &rarr;
      </Button>
    </div>
  );
}
