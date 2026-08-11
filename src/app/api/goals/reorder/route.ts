import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { reorderSchema } from "@/lib/validators";

export async function PUT(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderedIds } = parsed.data;

  // Apply all sort_order updates atomically, each scoped to the owner.
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.goal.updateMany({ where: { id, userId }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ success: true });
}
