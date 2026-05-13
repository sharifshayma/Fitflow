"use client";

import { useState, useEffect } from "react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { mutate as globalMutate } from "swr";
import type { FoodLogWithValues } from "@/lib/validators";
import dynamic from "next/dynamic";
import { FoodLogTable } from "@/components/food-log/food-log-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useGoals } from "@/lib/swr/use-goals";
import { useFoodLogs } from "@/lib/swr/use-food-logs";
import { FoodSuggestions } from "@/components/food-log/food-suggestions";
import { DailySummary } from "@/components/food-log/daily-summary";

const LogDialog = dynamic(
  () => import("@/components/food-log/log-dialog").then((mod) => mod.LogDialog),
  { ssr: false }
);

export default function LogPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [copySource, setCopySource] = useState<FoodLogWithValues | null>(null);
  const [editSource, setEditSource] = useState<FoodLogWithValues | null>(null);

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");
  const { goals } = useGoals();
  const { logs, isLoading, mutate: mutateLogs } = useFoodLogs(selectedDate);

  // Listen for bottom nav "+" tap to open the form
  useEffect(() => {
    const handleOpenForm = () => setFormOpen(true);
    window.addEventListener("open-food-log-form", handleOpenForm);
    return () => window.removeEventListener("open-food-log-form", handleOpenForm);
  }, []);

  const handleSubmit = (data: {
    food_name: string;
    logged_at: string;
    values: { goal_id: string; value: number }[];
  }) => {
    // Optimistic: add temp entry immediately
    const optimisticEntry: FoodLogWithValues = {
      id: `temp-${Date.now()}`,
      food_name: data.food_name,
      logged_at: data.logged_at,
      created_at: new Date().toISOString(),
      food_log_values: data.values.map((v) => ({
        id: `temp-${v.goal_id}`,
        food_log_id: `temp-${Date.now()}`,
        goal_id: v.goal_id,
        value: v.value,
      })),
    };

    mutateLogs((current) => [optimisticEntry, ...(current ?? [])], {
      revalidate: false,
    });

    fetch("/api/food-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((res) => {
      if (res.ok) {
        const name = data.food_name.toLowerCase();
        toast.success(
          name === "water" ? "Water logged" : name === "weight" ? "Weight logged" : "Food logged"
        );
        mutateLogs();
        globalMutate(
          (key) =>
            typeof key === "string" &&
            (key.startsWith("/api/dashboard") || key === "/api/food-logs/history"),
          undefined,
          { revalidate: true }
        );
      } else {
        toast.error("Failed to log entry");
        mutateLogs();
      }
    });
  };

  const handleDelete = async (id: string) => {
    mutateLogs((current) => current?.filter((log) => log.id !== id), {
      revalidate: false,
    });

    const res = await fetch(`/api/food-logs/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Entry deleted");
      mutateLogs();
      globalMutate(
        (key) => typeof key === "string" && key.startsWith("/api/dashboard"),
        undefined,
        { revalidate: true }
      );
    } else {
      toast.error("Failed to delete entry");
      mutateLogs();
    }
  };

  const handleCopy = (log: FoodLogWithValues) => {
    setCopySource(log);
    setEditSource(null);
    setFormOpen(true);
  };

  const handleEdit = (log: FoodLogWithValues) => {
    setEditSource(log);
    setCopySource(null);
    setFormOpen(true);
  };

  const handleUpdate = (id: string, data: {
    food_name: string;
    logged_at: string;
    values: { goal_id: string; value: number }[];
  }) => {
    // Optimistic: update entry immediately
    mutateLogs((current) =>
      current?.map((log) =>
        log.id === id
          ? {
              ...log,
              food_name: data.food_name,
              logged_at: data.logged_at,
              food_log_values: data.values.map((v) => ({
                id: `temp-${v.goal_id}`,
                food_log_id: id,
                goal_id: v.goal_id,
                value: v.value,
              })),
            }
          : log
      ),
      { revalidate: false }
    );

    fetch(`/api/food-logs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((res) => {
      if (res.ok) {
        toast.success("Entry updated");
        mutateLogs();
        globalMutate(
          (key) => typeof key === "string" && key.startsWith("/api/dashboard"),
          undefined,
          { revalidate: true }
        );
      } else {
        toast.error("Failed to update entry");
        mutateLogs();
      }
    });
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setCopySource(null);
      setEditSource(null);
    }
  };

  if (isLoading && logs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(prev => format(subDays(parseISO(prev), 1), "yyyy-MM-dd"))}>
            &larr;
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Fit Log</h1>
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

      <DailySummary logs={logs} goals={goals} />

      {isToday && <FoodSuggestions onSelect={handleCopy} />}

      <FoodLogTable logs={logs} goals={goals} onDelete={handleDelete} onCopy={handleCopy} onEdit={handleEdit} />

      <LogDialog
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        goals={goals}
        onSubmit={handleSubmit}
        onEdit={handleUpdate}
        initialData={copySource ? {
          food_name: copySource.food_name,
          logged_at: copySource.logged_at,
          values: copySource.food_log_values.map(v => ({ goal_id: v.goal_id, value: v.value })),
        } : null}
        editData={editSource ? {
          id: editSource.id,
          food_name: editSource.food_name,
          logged_at: editSource.logged_at,
          values: editSource.food_log_values.map(v => ({ goal_id: v.goal_id, value: v.value })),
        } : null}
      />
    </div>
  );
}
