import { getClient } from "../supabase.js";

export async function listGoals() {
  const supabase = await getClient();

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("sort_order");

  if (error) throw new Error(error.message);
  return data;
}

export async function saveGoal(params: {
  id?: string;
  name?: string;
  unit?: string;
  target_value?: number;
  goal_type?: string;
  direction?: string;
}) {
  const supabase = await getClient();

  if (params.id) {
    // Update existing goal
    const { id, ...updates } = params;
    const { data, error } = await supabase
      .from("goals")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // Create new goal
  if (!params.name || !params.unit || params.target_value === undefined) {
    throw new Error("name, unit, and target_value are required to create a goal");
  }

  // Get next sort_order
  const { data: existing } = await supabase
    .from("goals")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data, error } = await supabase
    .from("goals")
    .insert({
      name: params.name,
      unit: params.unit,
      target_value: params.target_value,
      goal_type: params.goal_type ?? "food",
      direction: params.direction ?? "max",
      sort_order: nextOrder,
      user_id: session!.user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteGoal(id: string) {
  const supabase = await getClient();

  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}
