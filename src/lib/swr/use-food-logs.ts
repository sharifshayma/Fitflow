import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { FoodLogWithValues } from "@/lib/validators";

export function useFoodLogs(date: string) {
  const tz = new Date().getTimezoneOffset();
  const key = `/api/food-logs?date=${date}&tz=${tz}`;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<FoodLogWithValues[]>(key, fetcher, {
      keepPreviousData: true,
    });

  return {
    logs: data ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
