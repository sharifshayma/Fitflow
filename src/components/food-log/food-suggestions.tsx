"use client";

import type { FoodLogWithValues } from "@/lib/validators";
import { useFoodSuggestions } from "@/lib/swr/use-food-suggestions";

type FoodSuggestionsProps = {
  onSelect: (log: FoodLogWithValues) => void;
};

export function FoodSuggestions({ onSelect }: FoodSuggestionsProps) {
  const { suggestions, isLoading } = useFoodSuggestions();

  if (isLoading || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        You usually log around this time
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            {suggestion.food_name}
            <span className="text-muted-foreground">+</span>
          </button>
        ))}
      </div>
    </div>
  );
}
