import useSWR from "swr";
import { fetcher } from "./fetcher";
import { format, addWeeks } from "date-fns";
import type { Goal } from "@/lib/validators";

type DashboardData = {
  goals: Goal[];
  aggregated: Record<string, Record<string, number>>;
};

export function useDashboard(weekStart: Date) {
  const from = format(weekStart, "yyyy-MM-dd");
  const to = format(addWeeks(weekStart, 1), "yyyy-MM-dd");
  const tz = new Date().getTimezoneOffset();
  const key = `/api/dashboard?from=${from}&to=${to}&tz=${tz}`;

  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    key,
    fetcher,
    {
      keepPreviousData: true,
    }
  );

  return {
    data: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
