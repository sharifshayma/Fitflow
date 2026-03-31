-- Run this in your Supabase SQL Editor to create the tables

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_name TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE food_log_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_log_id UUID NOT NULL REFERENCES food_logs(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  UNIQUE(food_log_id, goal_id)
);

CREATE INDEX idx_food_logs_logged_at ON food_logs(logged_at);
CREATE INDEX idx_food_log_values_goal_id ON food_log_values(goal_id);
CREATE INDEX idx_food_log_values_food_log_id ON food_log_values(food_log_id);
