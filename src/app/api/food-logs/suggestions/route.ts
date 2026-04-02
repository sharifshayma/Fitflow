import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tz = searchParams.get("tz");
  const offsetMinutes = tz ? parseInt(tz, 10) : 0;

  // Compute "now" in user's local timezone
  const now = new Date();
  const localNow = new Date(now.getTime() - offsetMinutes * 60000);
  const currentHour = localNow.getUTCHours();

  // Compute today's start in UTC (for excluding today)
  const todayLocal = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate())
  );
  const todayStartUTC = new Date(todayLocal.getTime() + offsetMinutes * 60000);

  // 30 days ago
  const thirtyDaysAgo = new Date(todayStartUTC.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .lt("logged_at", todayStartUTC.toISOString())
    .gte("logged_at", thirtyDaysAgo.toISOString())
    .order("logged_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by time-of-day window: ±3 hours from current local hour
  const filtered = (data ?? []).filter((log) => {
    const logTime = new Date(log.logged_at);
    const logLocal = new Date(logTime.getTime() - offsetMinutes * 60000);
    const logHour = logLocal.getUTCHours();

    // Circular distance between hours (handles midnight wrapping)
    const diff = Math.abs(logHour - currentHour);
    const circularDiff = Math.min(diff, 24 - diff);
    return circularDiff <= 3;
  });

  // Deduplicate by food_name (case-insensitive), keep most recent
  const seen = new Set<string>();
  const unique = filtered.filter((log) => {
    const key = log.food_name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Return top 3
  return NextResponse.json(unique.slice(0, 3));
}
