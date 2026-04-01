import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { error } = await supabase.from("food_logs").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();

  const { food_name, logged_at, values } = body;

  // Update food log
  if (food_name || logged_at) {
    const updates: Record<string, string> = {};
    if (food_name) updates.food_name = food_name;
    if (logged_at) updates.logged_at = logged_at;

    const { error } = await supabase.from("food_logs").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update values if provided
  if (values && Array.isArray(values)) {
    // Delete existing values and re-insert
    await supabase.from("food_log_values").delete().eq("food_log_id", id);

    if (values.length > 0) {
      const valueRows = values.map((v: { goal_id: string; value: number }) => ({
        food_log_id: id,
        goal_id: v.goal_id,
        value: v.value,
      }));
      const { error } = await supabase.from("food_log_values").insert(valueRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
