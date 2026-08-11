import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { serializeFoodLog } from "@/lib/serializers";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
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

  const logs = await prisma.foodLog.findMany({
    where: { userId, loggedAt: { lt: todayStartUTC, gte: thirtyDaysAgo } },
    orderBy: { loggedAt: "desc" },
    take: 100,
    include: { values: true },
  });

  // Filter by time-of-day window: ±3 hours from current local hour
  const filtered = logs.filter((log) => {
    const logLocal = new Date(log.loggedAt.getTime() - offsetMinutes * 60000);
    const logHour = logLocal.getUTCHours();

    // Circular distance between hours (handles midnight wrapping)
    const diff = Math.abs(logHour - currentHour);
    const circularDiff = Math.min(diff, 24 - diff);
    return circularDiff <= 3;
  });

  // Deduplicate by food_name (case-insensitive), keep most recent
  const seen = new Set<string>();
  const unique = filtered.filter((log) => {
    const key = log.foodName.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Return top 3
  return NextResponse.json(unique.slice(0, 3).map((l) => serializeFoodLog(l)), {
    headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" },
  });
}
