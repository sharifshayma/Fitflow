"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayCell } from "./day-cell";
import { DayDetailDialog } from "./day-detail-dialog";
import type { Goal } from "@/lib/validators";
import { format } from "date-fns";

type GoalCardProps = {
  goal: Goal;
  dailyData: Record<string, number>;
  days: Date[];
};

export function GoalCard({ goal, dailyData, days }: GoalCardProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayValue = dailyData[todayStr] ?? 0;
  const remaining = goal.target_value - todayValue;
  const fmt = (n: number) => goal.target_value % 1 !== 0 ? n.toFixed(1) : String(Math.round(n));

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{goal.name}</CardTitle>
            <span className="text-sm text-muted-foreground">
              {fmt(todayValue)} / {goal.target_value} {goal.unit}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {goal.direction === "min"
              ? remaining > 0
                ? `${fmt(remaining)} ${goal.unit} more to go`
                : `Target reached! +${fmt(Math.abs(remaining))} ${goal.unit}`
              : remaining > 0
                ? `${fmt(remaining)} ${goal.unit} remaining today`
                : `Over by ${fmt(Math.abs(remaining))} ${goal.unit}`}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const value = dailyData[dateStr] ?? null;
              return (
                <DayCell
                  key={dateStr}
                  date={dateStr}
                  dayLabel={format(day, "EEE")}
                  value={value}
                  target={goal.target_value}
                  unit={goal.unit}
                  direction={goal.direction}
                  onClick={() => setSelectedDate(dateStr)}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
        <DayDetailDialog
          goalId={goal.id}
          goalName={goal.name}
          goalUnit={goal.unit}
          date={selectedDate}
          open={!!selectedDate}
          onOpenChange={(open) => {
            if (!open) setSelectedDate(null);
          }}
        />
      )}
    </>
  );
}
