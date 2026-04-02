import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { FoodLogWithValues } from "@/lib/validators";

export function useFoodSuggestions() {
  const tz = new Date().getTimezoneOffset();
  const key = `/api/food-logs/suggestions?tz=${tz}`;

  const { data, error, isLoading } = useSWR<FoodLogWithValues[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000, // 5 minutes
  });

  return {
    suggestions: data ?? [],
    isLoading,
    error,
  };
}
