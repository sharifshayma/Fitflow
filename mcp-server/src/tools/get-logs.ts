import { getClient } from "../supabase.js";

export async function getLogs(params: {
  view: "daily" | "suggestions" | "dashboard";
  date?: string;
  from?: string;
  to?: string;
  timezone_offset?: number;
}) {
  switch (params.view) {
    case "daily":
      return getDaily(params.date, params.timezone_offset);
    case "suggestions":
      return getSuggestions(params.timezone_offset);
    case "dashboard":
      return getDashboard(params.from, params.to, params.timezone_offset);
    default:
      throw new Error(`Unknown view: ${params.view}`);
  }
}

async function getDaily(date?: string, timezoneOffset?: number) {
  const supabase = await getClient();

  let query = supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .order("logged_at", { ascending: false });

  if (date) {
    const offsetMinutes = timezoneOffset ?? 0;
    const startLocal = new Date(`${date}T00:00:00`);
    const startUTC = new Date(startLocal.getTime() + offsetMinutes * 60000);
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
    query = query
      .gte("logged_at", startUTC.toISOString())
      .lt("logged_at", endUTC.toISOString());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function getSuggestions(timezoneOffset?: number) {
  const supabase = await getClient();
  const offsetMinutes = timezoneOffset ?? 0;

  const now = new Date();
  const localNow = new Date(now.getTime() - offsetMinutes * 60000);
  const currentHour = localNow.getUTCHours();

  // Today's start in UTC (to exclude today)
  const todayLocal = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate())
  );
  const todayStartUTC = new Date(todayLocal.getTime() + offsetMinutes * 60000);
  const thirtyDaysAgo = new Date(todayStartUTC.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .lt("logged_at", todayStartUTC.toISOString())
    .gte("logged_at", thirtyDaysAgo.toISOString())
    .order("logged_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  // Filter by +-3 hour window around current local hour
  const filtered = (data ?? []).filter((log) => {
    const logTime = new Date(log.logged_at);
    const logLocal = new Date(logTime.getTime() - offsetMinutes * 60000);
    const logHour = logLocal.getUTCHours();
    const diff = Math.abs(logHour - currentHour);
    const circularDiff = Math.min(diff, 24 - diff);
    return circularDiff <= 3;
  });

  // Deduplicate by food_name, keep most recent
  const seen = new Set<string>();
  const unique = filtered.filter((log) => {
    const key = log.food_name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 3);
}

async function getDashboard(from?: string, to?: string, timezoneOffset?: number) {
  if (!from || !to) throw new Error("from and to dates are required for dashboard view");

  const supabase = await getClient();
  const offsetMinutes = timezoneOffset ?? 0;

  const [goalsResult, logsResult] = await Promise.all([
    supabase.from("goals").select("*").order("sort_order"),
    supabase
      .from("food_logs")
      .select("id, logged_at, food_log_values(goal_id, value)")
      .gte(
        "logged_at",
        new Date(
          new Date(`${from}T00:00:00`).getTime() + offsetMinutes * 60000
        ).toISOString()
      )
      .lt(
        "logged_at",
        new Date(
          new Date(`${to}T00:00:00`).getTime() +
            offsetMinutes * 60000 +
            24 * 60 * 60 * 1000
        ).toISOString()
      ),
  ]);

  if (goalsResult.error) throw new Error(goalsResult.error.message);
  if (logsResult.error) throw new Error(logsResult.error.message);

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
      aggregated[val.goal_id][date] =
        (aggregated[val.goal_id][date] || 0) + val.value;
    }
  }

  return { goals, aggregated };
}
