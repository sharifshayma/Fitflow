import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { foodLogSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const tz = searchParams.get("tz");

  let query = supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .order("logged_at", { ascending: false });

  if (date) {
    const offsetMinutes = tz ? parseInt(tz, 10) : 0;
    const startLocal = new Date(`${date}T00:00:00`);
    const startUTC = new Date(startLocal.getTime() + offsetMinutes * 60000);
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
    query = query
      .gte("logged_at", startUTC.toISOString())
      .lt("logged_at", endUTC.toISOString());
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();
  const parsed = foodLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { food_name, logged_at, values } = parsed.data;

  const { data: foodLog, error: logError } = await supabase
    .from("food_logs")
    .insert({ food_name, logged_at, user_id: user.id })
    .select()
    .single();

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

  if (values.length > 0) {
    const valueRows = values.map((v) => ({
      food_log_id: foodLog.id,
      goal_id: v.goal_id,
      value: v.value,
    }));

    const { error: valError } = await supabase
      .from("food_log_values")
      .insert(valueRows);

    if (valError) return NextResponse.json({ error: valError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .eq("id", foodLog.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
