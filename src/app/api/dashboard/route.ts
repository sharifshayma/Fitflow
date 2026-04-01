import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const tz = searchParams.get("tz");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to query params required" }, { status: 400 });
  }

  const offsetMinutes = tz ? parseInt(tz, 10) : 0;

  // Fetch goals and food logs in parallel
  const [goalsResult, logsResult] = await Promise.all([
    supabase.from("goals").select("*").order("sort_order"),
    supabase
      .from("food_logs")
      .select("id, logged_at, food_log_values(goal_id, value)")
      .gte("logged_at", new Date(new Date(`${from}T00:00:00`).getTime() + offsetMinutes * 60000).toISOString())
      .lt("logged_at", new Date(new Date(`${to}T00:00:00`).getTime() + offsetMinutes * 60000 + 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (goalsResult.error) return NextResponse.json({ error: goalsResult.error.message }, { status: 500 });
  if (logsResult.error) return NextResponse.json({ error: logsResult.error.message }, { status: 500 });

  const goals = goalsResult.data;
  const foodLogs = logsResult.data;

  // Aggregate: { goalId -> { date -> totalValue } }
  const aggregated: Record<string, Record<string, number>> = {};

  for (const goal of goals ?? []) {
    aggregated[goal.id] = {};
  }

  for (const log of foodLogs ?? []) {
    const logUTC = new Date(log.logged_at);
    const logLocal = new Date(logUTC.getTime() - offsetMinutes * 60000);
    const date = logLocal.toISOString().split("T")[0];
    for (const val of log.food_log_values) {
      if (!aggregated[val.goal_id]) aggregated[val.goal_id] = {};
      aggregated[val.goal_id][date] = (aggregated[val.goal_id][date] || 0) + val.value;
    }
  }

  return NextResponse.json({ goals, aggregated });
}
