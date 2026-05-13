import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look back up to a year, capped at 1000 rows for safety.
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("food_logs")
    .select("id, food_name, logged_at, food_log_values(goal_id, value)")
    .gte("logged_at", oneYearAgo.toISOString())
    .order("logged_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    food_name: string;
    logged_at: string;
    food_log_values: { goal_id: string; value: number }[];
  };

  type HistoryItem = {
    food_name: string;
    count: number;
    last_logged_at: string;
    values: { goal_id: string; value: number }[];
  };

  const grouped = new Map<string, HistoryItem>();

  for (const row of (data ?? []) as Row[]) {
    const trimmed = row.food_name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    // Skip the Water/Weight pseudo-entries — those have their own tabs.
    if (key === "water" || key === "weight") continue;

    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      // Rows are ordered by logged_at desc, so the first one seen is the most recent.
      grouped.set(key, {
        food_name: trimmed,
        count: 1,
        last_logged_at: row.logged_at,
        values: row.food_log_values.map((v) => ({
          goal_id: v.goal_id,
          value: v.value,
        })),
      });
    }
  }

  const items = Array.from(grouped.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.last_logged_at.localeCompare(a.last_logged_at);
  });

  return NextResponse.json(items, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}
