"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, addWeeks, eachDayOfInterval, endOfWeek, isBefore, startOfDay } from "date-fns";
import type { Goal } from "@/lib/validators";
import { GoalCard } from "@/components/dashboard/goal-card";
import { DateNavigator } from "@/components/dashboard/date-navigator";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type DashboardData = {
  goals: Goal[];
  aggregated: Record<string, Record<string, number>>;
};

export default function DashboardPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(addWeeks(weekStart, 1), "yyyy-MM-dd");
    const tz = new Date().getTimezoneOffset();
    const res = await fetch(`/api/dashboard?from=${from}&to=${to}&tz=${tz}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const canGoNext = isBefore(weekEnd, startOfDay(new Date()));

  if (loading && !data) {
    return <p className="text-muted-foreground text-center py-8">Loading dashboard...</p>;
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
