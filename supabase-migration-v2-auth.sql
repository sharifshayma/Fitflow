-- Run this in your Supabase SQL Editor to add user_id columns
-- This adds multi-user support with auth

-- Add user_id to goals
ALTER TABLE goals ADD COLUMN user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_goals_user_id ON goals(user_id);

-- Add user_id to food_logs
ALTER TABLE food_logs ADD COLUMN user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_food_logs_user_id ON food_logs(user_id);

-- Enable RLS on all tables
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_log_values ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies if they exist
DROP POLICY IF EXISTS "Allow all on goals" ON goals;
DROP POLICY IF EXISTS "Allow all on food_logs" ON food_logs;
DROP POLICY IF EXISTS "Allow all on food_log_values" ON food_log_values;

-- Goals: users can only access their own goals
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- Food logs: users can only access their own food logs
CREATE POLICY "Users can view own food_logs" ON food_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own food_logs" ON food_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own food_logs" ON food_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own food_logs" ON food_logs FOR DELETE USING (auth.uid() = user_id);

-- Food log values: access through food_logs ownership
CREATE POLICY "Users can view own food_log_values" ON food_log_values FOR SELECT
  USING (EXISTS (SELECT 1 FROM food_logs WHERE food_logs.id = food_log_values.food_log_id AND food_logs.user_id = auth.uid()));
CREATE POLICY "Users can insert own food_log_values" ON food_log_values FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM food_logs WHERE food_logs.id = food_log_values.food_log_id AND food_logs.user_id = auth.uid()));
CREATE POLICY "Users can update own food_log_values" ON food_log_values FOR UPDATE
  USING (EXISTS (SELECT 1 FROM food_logs WHERE food_logs.id = food_log_values.food_log_id AND food_logs.user_id = auth.uid()));
CREATE POLICY "Users can delete own food_log_values" ON food_log_values FOR DELETE
  USING (EXISTS (SELECT 1 FROM food_logs WHERE food_logs.id = food_log_values.food_log_id AND food_logs.user_id = auth.uid()));
