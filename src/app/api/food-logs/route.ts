import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth-shim";
import { foodLogSchema } from "@/lib/validators";
import { serializeFoodLog } from "@/lib/serializers";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const tz = searchParams.get("tz");

  const where: { userId: string; loggedAt?: { gte: Date; lt: Date } } = { userId };
  if (date) {
    const offsetMinutes = tz ? parseInt(tz, 10) : 0;
    const startLocal = new Date(`${date}T00:00:00`);
    const startUTC = new Date(startLocal.getTime() + offsetMinutes * 60000);
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
    where.loggedAt = { gte: startUTC, lt: endUTC };
  }

  const logs = await prisma.foodLog.findMany({
    where,
    orderBy: { loggedAt: "desc" },
    include: { values: true },
  });

  return NextResponse.json(logs.map((l) => serializeFoodLog(l)));
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = foodLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { food_name, logged_at, values } = parsed.data;

  const created = await prisma.foodLog.create({
    data: {
      userId,
      foodName: food_name,
      loggedAt: new Date(logged_at),
      values:
        values.length > 0
          ? { create: values.map((v) => ({ goalId: v.goal_id, value: v.value })) }
          : undefined,
    },
    include: { values: true },
  });

  return NextResponse.json(serializeFoodLog(created), { status: 201 });
}
