import useSWR from "swr";
import { fetcher } from "./fetcher";

export type FoodHistoryItem = {
  food_name: string;
  count: number;
  last_logged_at: string;
  values: { goal_id: string; value: number }[];
};

export function useFoodHistory(enabled: boolean = true) {
  const key = enabled ? "/api/food-logs/history" : null;

  const { data, error, isLoading } = useSWR<FoodHistoryItem[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  return {
    history: data ?? [],
    isLoading,
    error,
  };
}
