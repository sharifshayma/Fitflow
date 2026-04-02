import { z } from "zod";

export const goalTypeOptions = ["food", "water", "weight"] as const;
export const goalDirectionOptions = ["min", "max"] as const;

export type GoalType = (typeof goalTypeOptions)[number];
export type GoalDirection = (typeof goalDirectionOptions)[number];

export const goalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.string().min(1, "Unit is required"),
  target_value: z.coerce.number().positive("Target must be a positive number"),
  goal_type: z.enum(goalTypeOptions).default("food"),
  direction: z.enum(goalDirectionOptions).default("max"),
});

export const foodLogSchema = z.object({
  food_name: z.string().min(1, "Food name is required"),
  logged_at: z.string(),
  values: z.array(
    z.object({
      goal_id: z.string().uuid(),
      value: z.coerce.number().min(0, "Value must be 0 or greater"),
    })
  ),
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type FoodLogInput = z.infer<typeof foodLogSchema>;

export type Goal = {
  id: string;
  name: string;
  unit: string;
  target_value: number;
  goal_type: GoalType;
  direction: GoalDirection;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type FoodLog = {
  id: string;
  food_name: string;
  logged_at: string;
  created_at: string;
};

export type FoodLogValue = {
  id: string;
  food_log_id: string;
  goal_id: string;
  value: number;
};

export type FoodLogWithValues = FoodLog & {
  food_log_values: FoodLogValue[];
};
