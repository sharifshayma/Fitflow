import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth-shim";
import { goalSchema } from "@/lib/validators";
import { serializeGoal } from "@/lib/serializers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  const parsed = goalSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;
  const data: Record<string, unknown> = {};
  if (p.name !== undefined) data.name = p.name;
  if (p.unit !== undefined) data.unit = p.unit;
  if (p.target_value !== undefined) data.targetValue = p.target_value;
  if (p.goal_type !== undefined) data.goalType = p.goal_type;
  if (p.direction !== undefined) data.direction = p.direction;
  // updated_at is maintained automatically (@updatedAt).

  // Scope the update to the owner; updateMany lets us filter by userId.
  const result = await prisma.goal.updateMany({ where: { id, userId }, data });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const goal = await prisma.goal.findUnique({ where: { id } });
  return NextResponse.json(serializeGoal(goal!));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  await prisma.goal.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
