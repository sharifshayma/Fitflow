import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { Goal } from "@/lib/validators";

export function useGoals() {
  const { data, error, isLoading, mutate } = useSWR<Goal[]>(
    "/api/goals",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  return {
    goals: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
