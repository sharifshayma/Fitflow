import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { withMcpAuth } from "better-auth/plugins";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeGoal, serializeFoodLog } from "@/lib/serializers";

// --- Tool handlers (Prisma, scoped by the authenticated userId) ---

async function listGoals(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
  return goals.map(serializeGoal);
}

async function saveGoal(
  userId: string,
  params: {
    id?: string;
    name?: string;
    unit?: string;
    target_value?: number;
    goal_type?: string;
    direction?: string;
  }
) {
  if (params.id) {
    const data: Record<string, unknown> = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.unit !== undefined) data.unit = params.unit;
    if (params.target_value !== undefined) data.targetValue = params.target_value;
    if (params.goal_type !== undefined) data.goalType = params.goal_type;
    if (params.direction !== undefined) data.direction = params.direction;

    const res = await prisma.goal.updateMany({ where: { id: params.id, userId }, data });
    if (res.count === 0) throw new Error("Goal not found");
    const goal = await prisma.goal.findUnique({ where: { id: params.id } });
    return serializeGoal(goal!);
  }

  if (!params.name || !params.unit || params.target_value === undefined) {
    throw new Error("name, unit, and target_value are required to create a goal");
  }

  const last = await prisma.goal.findFirst({
    where: { userId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextOrder = last ? last.sortOrder + 1 : 0;

  const goal = await prisma.goal.create({
    data: {
      userId,
      name: params.name,
      unit: params.unit,
      targetValue: params.target_value,
      goalType: params.goal_type ?? "food",
      direction: params.direction ?? "max",
      sortOrder: nextOrder,
    },
  });
  return serializeGoal(goal);
}

async function deleteGoal(userId: string, id: string) {
  await prisma.goal.deleteMany({ where: { id, userId } });
  return { success: true };
}

async function logEntry(
  userId: string,
  params: {
    type: "food" | "water" | "weight";
    food_name?: string;
    values?: { goal_id: string; value: number }[];
    amount?: number;
    logged_at?: string;
  }
) {
  const loggedAt = params.logged_at ? new Date(params.logged_at) : new Date();
  let foodName: string;
  let values: { goal_id: string; value: number }[];

  if (params.type === "food") {
    if (!params.food_name) throw new Error("food_name is required for food entries");
    if (!params.values || params.values.length === 0) {
      throw new Error("values array is required for food entries");
    }
    foodName = params.food_name;
    values = params.values;
  } else {
    if (params.amount === undefined) {
      throw new Error(`amount is required for ${params.type} entries`);
    }
    const goal = await prisma.goal.findFirst({
      where: { userId, goalType: params.type },
      select: { id: true },
    });
    if (!goal) {
      throw new Error(`No ${params.type} goal found. Create a ${params.type} goal first.`);
    }
    foodName = params.type === "water" ? "Water" : "Weight";
    values = [{ goal_id: goal.id, value: params.amount }];
  }

  const created = await prisma.foodLog.create({
    data: {
      userId,
      foodName,
      loggedAt,
      values: { create: values.map((v) => ({ goalId: v.goal_id, value: v.value })) },
    },
    include: { values: true },
  });
  return serializeFoodLog(created);
}

async function getLogs(
  userId: string,
  params: {
    view: "daily" | "suggestions" | "dashboard";
    date?: string;
    from?: string;
    to?: string;
    timezone_offset?: number;
  }
) {
  switch (params.view) {
    case "daily":
      return getDaily(userId, params.date, params.timezone_offset);
    case "suggestions":
      return getSuggestions(userId, params.timezone_offset);
    case "dashboard":
      return getDashboard(userId, params.from, params.to, params.timezone_offset);
    default:
      throw new Error(`Unknown view: ${params.view}`);
  }
}

async function getDaily(userId: string, date?: string, timezoneOffset?: number) {
  const where: { userId: string; loggedAt?: { gte: Date; lt: Date } } = { userId };
  if (date) {
    const offsetMinutes = timezoneOffset ?? 0;
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
  return logs.map((l) => serializeFoodLog(l));
}

async function getSuggestions(userId: string, timezoneOffset?: number) {
  const offsetMinutes = timezoneOffset ?? 0;
  const now = new Date();
  const localNow = new Date(now.getTime() - offsetMinutes * 60000);
  const currentHour = localNow.getUTCHours();

  const todayLocal = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate())
  );
  const todayStartUTC = new Date(todayLocal.getTime() + offsetMinutes * 60000);
  const thirtyDaysAgo = new Date(todayStartUTC.getTime() - 30 * 24 * 60 * 60 * 1000);

  const logs = await prisma.foodLog.findMany({
    where: { userId, loggedAt: { lt: todayStartUTC, gte: thirtyDaysAgo } },
    orderBy: { loggedAt: "desc" },
    take: 100,
    include: { values: true },
  });

  const filtered = logs.filter((log) => {
    const logLocal = new Date(log.loggedAt.getTime() - offsetMinutes * 60000);
    const logHour = logLocal.getUTCHours();
    const diff = Math.abs(logHour - currentHour);
    const circularDiff = Math.min(diff, 24 - diff);
    return circularDiff <= 3;
  });

  const seen = new Set<string>();
  const unique = filtered.filter((log) => {
    const key = log.foodName.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 3).map((l) => serializeFoodLog(l));
}

async function getDashboard(
  userId: string,
  from?: string,
  to?: string,
  timezoneOffset?: number
) {
  if (!from || !to) throw new Error("from and to dates are required for dashboard view");

  const offsetMinutes = timezoneOffset ?? 0;
  const startUTC = new Date(new Date(`${from}T00:00:00`).getTime() + offsetMinutes * 60000);
  const endUTC = new Date(
    new Date(`${to}T00:00:00`).getTime() + offsetMinutes * 60000 + 24 * 60 * 60 * 1000
  );

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

  const aggregated: Record<string, Record<string, number>> = {};
  for (const goal of goals) aggregated[goal.id] = {};
  for (const log of foodLogs) {
    const logLocal = new Date(log.loggedAt.getTime() - offsetMinutes * 60000);
    const date = logLocal.toISOString().split("T")[0];
    for (const val of log.values) {
      if (!aggregated[val.goalId]) aggregated[val.goalId] = {};
      aggregated[val.goalId][date] = (aggregated[val.goalId][date] || 0) + Number(val.value);
    }
  }

  return { goals: goals.map(serializeGoal), aggregated };
}

async function editLog(
  userId: string,
  params: {
    action: "update" | "delete";
    id: string;
    food_name?: string;
    logged_at?: string;
    values?: { goal_id: string; value: number }[];
  }
) {
  if (params.action === "delete") {
    await prisma.foodLog.deleteMany({ where: { id: params.id, userId } });
    return { success: true };
  }

  const existing = await prisma.foodLog.findFirst({
    where: { id: params.id, userId },
    select: { id: true },
  });
  if (!existing) throw new Error("Log not found");

  const logUpdate: { foodName?: string; loggedAt?: Date } = {};
  if (params.food_name) logUpdate.foodName = params.food_name;
  if (params.logged_at) logUpdate.loggedAt = new Date(params.logged_at);

  await prisma.$transaction(async (tx) => {
    if (Object.keys(logUpdate).length > 0) {
      await tx.foodLog.update({ where: { id: params.id }, data: logUpdate });
    }
    if (params.values && Array.isArray(params.values)) {
      await tx.foodLogValue.deleteMany({ where: { foodLogId: params.id } });
      if (params.values.length > 0) {
        await tx.foodLogValue.createMany({
          data: params.values.map((v) => ({
            foodLogId: params.id,
            goalId: v.goal_id,
            value: v.value,
          })),
        });
      }
    }
  });

  const updated = await prisma.foodLog.findUnique({
    where: { id: params.id },
    include: { values: true },
  });
  return serializeFoodLog(updated!);
}

// --- Tool definitions (unchanged schemas the Claude connector already knows) ---

const TOOL_DEFINITIONS = [
  {
    name: "log_entry",
    description:
      "Log a food, water, or weight entry. IMPORTANT: Before logging ANY entry, always call list_goals first to discover the user's goals. Each goal has a goal_type (food, water, or weight). For the entry type being logged, find all goals matching that goal_type and provide a value for each in the values array. For food entries: provide food_name and values for ALL food-type goals (e.g. calories, protein, carbs, fats, fiber). When the user describes a meal or sends a photo, estimate nutritional values for every food-type goal. For water entries: provide food_name='Water' and the value for the water-type goal. For weight entries: provide food_name='Weight' and the value for the weight-type goal.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["food", "water", "weight"], description: "Type of entry to log" },
        food_name: { type: "string", description: "Name of the food (required for food type, auto-set for water/weight)" },
        values: {
          type: "array",
          items: {
            type: "object",
            properties: { goal_id: { type: "string" }, value: { type: "number" } },
            required: ["goal_id", "value"],
          },
          description: "Goal values (required for food type)",
        },
        amount: { type: "number", description: "Amount to log (required for water/weight type)" },
        logged_at: { type: "string", description: "ISO 8601 timestamp (defaults to now)" },
      },
      required: ["type"],
    },
  },
  {
    name: "get_logs",
    description:
      "Get food logs, suggestions, or dashboard data. Use view='daily' to see logs for a date, 'suggestions' for smart food suggestions based on time of day, or 'dashboard' for aggregated goal progress over a date range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        view: { type: "string", enum: ["daily", "suggestions", "dashboard"], description: "What to retrieve" },
        date: { type: "string", description: "YYYY-MM-DD date for daily view (defaults to today)" },
        from: { type: "string", description: "YYYY-MM-DD start date for dashboard view" },
        to: { type: "string", description: "YYYY-MM-DD end date for dashboard view" },
        timezone_offset: { type: "number", description: "Minutes from UTC (e.g. -300 for EST)" },
      },
      required: ["view"],
    },
  },
  {
    name: "edit_log",
    description:
      "Update or delete a food/water/weight log entry. For updates, provide the fields to change. For values, the entire values array is replaced.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["update", "delete"], description: "Whether to update or delete the entry" },
        id: { type: "string", description: "UUID of the food log entry" },
        food_name: { type: "string", description: "Updated food name (for update action)" },
        logged_at: { type: "string", description: "Updated timestamp (for update action)" },
        values: {
          type: "array",
          items: {
            type: "object",
            properties: { goal_id: { type: "string" }, value: { type: "number" } },
            required: ["goal_id", "value"],
          },
          description: "Replacement values (for update action)",
        },
      },
      required: ["action", "id"],
    },
  },
  {
    name: "list_goals",
    description:
      "List all health tracking goals (food, water, weight) sorted by display order. Returns id, name, unit, target_value, goal_type, and direction for each goal.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "save_goal",
    description:
      "Create or update a health goal. Omit id to create a new goal. Provide id to update an existing one. goal_type can be 'food', 'water', or 'weight'. direction can be 'min' or 'max'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Goal UUID (omit to create new, provide to update)" },
        name: { type: "string", description: "Goal name (e.g. 'Calories', 'Protein')" },
        unit: { type: "string", description: "Unit of measurement (e.g. 'kcal', 'g', 'cups')" },
        target_value: { type: "number", description: "Target value to reach" },
        goal_type: { type: "string", enum: ["food", "water", "weight"], description: "Type of goal (default: food)" },
        direction: { type: "string", enum: ["min", "max"], description: "Whether to minimize or maximize toward target (default: max)" },
      },
    },
  },
  {
    name: "delete_goal",
    description: "Delete a health tracking goal by ID. This also removes all associated log values.",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "Goal UUID to delete" } },
      required: ["id"],
    },
  },
];

// --- MCP server factory (bound to a userId) ---

function createMcpServer(userId: string) {
  const server = new Server(
    { name: "fitflow", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      let result: unknown;
      switch (name) {
        case "log_entry":
          result = await logEntry(userId, args as Parameters<typeof logEntry>[1]);
          break;
        case "get_logs":
          result = await getLogs(userId, args as Parameters<typeof getLogs>[1]);
          break;
        case "edit_log":
          result = await editLog(userId, args as Parameters<typeof editLog>[1]);
          break;
        case "list_goals":
          result = await listGoals(userId);
          break;
        case "save_goal":
          result = await saveGoal(userId, args as Parameters<typeof saveGoal>[1]);
          break;
        case "delete_goal":
          result = await deleteGoal(userId, (args as { id: string }).id);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  });

  return server;
}

// --- Route: OAuth-protected via the better-auth MCP plugin ---
// withMcpAuth validates the Bearer access token (issued by our OAuth server) and
// provides the session; session.userId scopes every tool to that user.

export const POST = withMcpAuth(auth, async (request: Request, session) => {
  const userId = session.userId;
  const server = createMcpServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  await server.connect(transport);
  return transport.handleRequest(request);
});
