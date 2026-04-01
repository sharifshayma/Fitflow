"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays, subDays, parseISO } from "date-fns";
import type { Goal, FoodLogWithValues } from "@/lib/validators";
import { FoodLogForm } from "@/components/food-log/food-log-form";
import { FoodLogTable } from "@/components/food-log/food-log-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LogPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [logs, setLogs] = useState<FoodLogWithValues[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [copySource, setCopySource] = useState<FoodLogWithValues | null>(null);

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    const tz = new Date().getTimezoneOffset();
    const [goalsRes, logsRes] = await Promise.all([
      fetch("/api/goals"),
      fetch(`/api/food-logs?date=${selectedDate}&tz=${tz}`),
    ]);
    const goalsData = await goalsRes.json();
    const logsData = await logsRes.json();
    setGoals(Array.isArray(goalsData) ? goalsData : []);
    setLogs(Array.isArray(logsData) ? logsData : []);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for bottom nav "+" tap to open the form
  useEffect(() => {
    const handleOpenForm = () => setFormOpen(true);
    window.addEventListener("open-food-log-form", handleOpenForm);
    return () => window.removeEventListener("open-food-log-form", handleOpenForm);
  }, []);

  const handleSubmit = async (data: {
    food_name: string;
    logged_at: string;
    values: { goal_id: string; value: number }[];
  }) => {
    const res = await fetch("/api/food-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Food logged");
      fetchData();
    } else {
      toast.error("Failed to log food");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/food-logs/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Entry deleted");
      fetchData();
    } else {
      toast.error("Failed to delete entry");
    }
  };

  const handleCopy = (log: FoodLogWithValues) => {
    setCopySource(log);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setCopySource(null);
  };

  if (loading) {
    return null; // loading.tsx skeleton handles this
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(prev => format(subDays(parseISO(prev), 1), "yyyy-MM-dd"))}>
            &larr;
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Food Log</h1>
            <p className="text-muted-foreground">
              {isToday ? "Today, " : ""}{format(parseISO(selectedDate), "MMMM d, yyyy")}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(prev => format(addDays(parseISO(prev), 1), "yyyy-MM-dd"))} disabled={isToday}>
            &rarr;
          </Button>
        </div>
        <Button onClick={() => setFormOpen(true)} size="lg" className="rounded-full h-12 w-12 text-xl">
          +
        </Button>
      </div>

      <FoodLogTable logs={logs} goals={goals} onDelete={handleDelete} onCopy={handleCopy} />

      <FoodLogForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        goals={goals}
        onSubmit={handleSubmit}
        initialData={copySource ? {
          food_name: copySource.food_name,
          logged_at: copySource.logged_at,
          values: copySource.food_log_values.map(v => ({ goal_id: v.goal_id, value: v.value })),
        } : null}
      />
    </div>
  );
}
