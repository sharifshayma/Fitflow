import { getClient } from "../supabase.js";

export async function editLog(params: {
  action: "update" | "delete";
  id: string;
  food_name?: string;
  logged_at?: string;
  values?: { goal_id: string; value: number }[];
}) {
  const supabase = await getClient();

  if (params.action === "delete") {
    const { error } = await supabase.from("food_logs").delete().eq("id", params.id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // Update
  if (params.food_name || params.logged_at) {
    const updates: Record<string, string> = {};
    if (params.food_name) updates.food_name = params.food_name;
    if (params.logged_at) updates.logged_at = params.logged_at;

    const { error } = await supabase
      .from("food_logs")
      .update(updates)
      .eq("id", params.id);

    if (error) throw new Error(error.message);
  }

  // Replace values if provided
  if (params.values && Array.isArray(params.values)) {
    await supabase.from("food_log_values").delete().eq("food_log_id", params.id);

    if (params.values.length > 0) {
      const valueRows = params.values.map((v) => ({
        food_log_id: params.id,
        goal_id: v.goal_id,
        value: v.value,
      }));

      const { error } = await supabase.from("food_log_values").insert(valueRows);
      if (error) throw new Error(error.message);
    }
  }

  // Return updated log
  const { data, error } = await supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .eq("id", params.id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}
