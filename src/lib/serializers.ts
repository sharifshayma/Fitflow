// Convert Prisma rows (camelCase fields, Decimal/Date types) back into the exact
// snake_case JSON shapes the frontend consumed from Supabase/PostgREST, so the
// data-layer swap in Phase 2 is invisible to callers.
import type { Goal, FoodLog, FoodLogValue } from "@prisma/client";

const num = (v: unknown): number => Number(v);
const iso = (d: Date): string => d.toISOString();

export function serializeGoal(g: Goal) {
  return {
    id: g.id,
    user_id: g.userId,
    name: g.name,
    unit: g.unit,
    target_value: num(g.targetValue),
    goal_type: g.goalType,
    direction: g.direction,
    sort_order: g.sortOrder,
    created_at: iso(g.createdAt),
    updated_at: iso(g.updatedAt),
  };
}

export function serializeFoodLogValue(v: FoodLogValue) {
  return {
    id: v.id,
    food_log_id: v.foodLogId,
    goal_id: v.goalId,
    value: num(v.value),
  };
}

export function serializeFoodLog(log: FoodLog & { values?: FoodLogValue[] }) {
  const out: Record<string, unknown> = {
    id: log.id,
    user_id: log.userId,
    food_name: log.foodName,
    logged_at: iso(log.loggedAt),
    created_at: iso(log.createdAt),
  };
  if (log.values) out.food_log_values = log.values.map(serializeFoodLogValue);
  return out;
}
