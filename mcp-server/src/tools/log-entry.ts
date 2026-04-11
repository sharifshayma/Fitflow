import { getClient } from "../supabase.js";

export async function logEntry(params: {
  type: "food" | "water" | "weight";
  food_name?: string;
  values?: { goal_id: string; value: number }[];
  amount?: number;
  logged_at?: string;
}) {
  const supabase = await getClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const loggedAt = params.logged_at ?? new Date().toISOString();
  let foodName: string;
  let values: { goal_id: string; value: number }[];

  if (params.type === "food") {
    if (!params.food_name) throw new Error("food_name is required for food entries");
    if (!params.values || params.values.length === 0) {
      throw new Error("values array is required for food entries");
    }
    foodName = params.food_name;
    values = params.values;
  } else {
    // Water or weight — find the matching goal automatically
    if (params.amount === undefined) {
      throw new Error(`amount is required for ${params.type} entries`);
    }

    const { data: goals, error: goalsError } = await supabase
      .from("goals")
      .select("id")
      .eq("goal_type", params.type)
      .limit(1);

    if (goalsError) throw new Error(goalsError.message);
    if (!goals || goals.length === 0) {
      throw new Error(
        `No ${params.type} goal found. Create a ${params.type} goal first.`
      );
    }

    foodName = params.type === "water" ? "Water" : "Weight";
    values = [{ goal_id: goals[0].id, value: params.amount }];
  }

  // Insert food log
  const { data: foodLog, error: logError } = await supabase
    .from("food_logs")
    .insert({ food_name: foodName, logged_at: loggedAt, user_id: session!.user.id })
    .select()
    .single();

  if (logError) throw new Error(logError.message);

  // Insert values
  if (values.length > 0) {
    const valueRows = values.map((v) => ({
      food_log_id: foodLog.id,
      goal_id: v.goal_id,
      value: v.value,
    }));

    const { error: valError } = await supabase
      .from("food_log_values")
      .insert(valueRows);

    if (valError) throw new Error(valError.message);
  }

  // Return the full log with values
  const { data, error } = await supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .eq("id", foodLog.id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}
