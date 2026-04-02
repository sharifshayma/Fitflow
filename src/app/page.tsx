"use client";

import { useState } from "react";
import { startOfWeek, addWeeks, eachDayOfInterval, endOfWeek, isBefore, startOfDay } from "date-fns";
import { GoalCard } from "@/components/dashboard/goal-card";
import { DateNavigator } from "@/components/dashboard/date-navigator";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/lib/swr/use-dashboard";

export default function DashboardPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const { data, isLoading } = useDashboard(weekStart);

  const canGoNext = isBefore(weekEnd, startOfDay(new Date()));

  if (isLoading && !data) {
    return null; // loading.tsx skeleton handles this
  }

  if (!data || !data.goals || data.goals.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium">No goals set up yet</p>
          <p className="text-sm mt-1 mb-4">Add goals in Settings to start tracking.</p>
          <Link href="/settings">
            <Button>Go to Settings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <DateNavigator
        weekStart={weekStart}
        onPrev={() => setWeekStart((prev) => addWeeks(prev, -1))}
        onNext={() => setWeekStart((prev) => addWeeks(prev, 1))}
        canGoNext={canGoNext}
      />
      <div className="space-y-4">
        {data.goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            dailyData={data.aggregated[goal.id] || {}}
            days={days}
          />
        ))}
      </div>
    </div>
  );
}
