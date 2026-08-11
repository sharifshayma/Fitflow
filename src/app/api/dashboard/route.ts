import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { serializeGoal } from "@/lib/serializers";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
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
  const startUTC = new Date(new Date(`${from}T00:00:00`).getTime() + offsetMinutes * 60000);
  const endUTC = new Date(
    new Date(`${to}T00:00:00`).getTime() + offsetMinutes * 60000 + 24 * 60 * 60 * 1000
  );

  // Fetch goals and food logs in parallel
  const [goals, foodLogs] = await Promise.all([
    prisma.goal.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
    prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: startUTC, lt: endUTC } },
      select: {
        id: true,
        loggedAt: true,
        values: { select: { goalId: true, value: true } },
      },
    }),
  ]);

  // Aggregate: { goalId -> { date -> totalValue } }
  const aggregated: Record<string, Record<string, number>> = {};

  for (const goal of goals) {
    aggregated[goal.id] = {};
  }

  for (const log of foodLogs) {
    const logLocal = new Date(log.loggedAt.getTime() - offsetMinutes * 60000);
    const date = logLocal.toISOString().split("T")[0];
    for (const val of log.values) {
      if (!aggregated[val.goalId]) aggregated[val.goalId] = {};
      aggregated[val.goalId][date] = (aggregated[val.goalId][date] || 0) + Number(val.value);
    }
  }

  return NextResponse.json(
    { goals: goals.map(serializeGoal), aggregated },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } }
  );
}
