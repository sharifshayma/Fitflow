import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth-shim";
import { serializeFoodLog } from "@/lib/serializers";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // food_log_values cascade-delete via the foreign key.
  await prisma.foodLog.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}

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
  const { food_name, logged_at, values } = body;

  // Confirm ownership before mutating.
  const existing = await prisma.foodLog.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logUpdate: { foodName?: string; loggedAt?: Date } = {};
  if (food_name) logUpdate.foodName = food_name;
  if (logged_at) logUpdate.loggedAt = new Date(logged_at);

  await prisma.$transaction(async (tx) => {
    if (Object.keys(logUpdate).length > 0) {
      await tx.foodLog.update({ where: { id }, data: logUpdate });
    }
    // Replace the value set when provided (delete + re-insert).
    if (values && Array.isArray(values)) {
      await tx.foodLogValue.deleteMany({ where: { foodLogId: id } });
      if (values.length > 0) {
        await tx.foodLogValue.createMany({
          data: values.map((v: { goal_id: string; value: number }) => ({
            foodLogId: id,
            goalId: v.goal_id,
            value: v.value,
          })),
        });
      }
    }
  });

  const updated = await prisma.foodLog.findUnique({
    where: { id },
    include: { values: true },
  });
  return NextResponse.json(serializeFoodLog(updated!));
}
