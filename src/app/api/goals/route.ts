import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth-shim";
import { goalSchema } from "@/lib/validators";
import { serializeGoal } from "@/lib/serializers";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(goals.map(serializeGoal), {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = goalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Next sort_order = current max + 1 (0 if none), scoped to this user.
  const last = await prisma.goal.findFirst({
    where: { userId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextOrder = last ? last.sortOrder + 1 : 0;

  const goal = await prisma.goal.create({
    data: {
      userId,
      name: parsed.data.name,
      unit: parsed.data.unit,
      targetValue: parsed.data.target_value,
      goalType: parsed.data.goal_type,
      direction: parsed.data.direction,
      sortOrder: nextOrder,
    },
  });

  return NextResponse.json(serializeGoal(goal), { status: 201 });
}
