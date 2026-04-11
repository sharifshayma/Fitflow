import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// --- Auth: create Supabase client from Bearer token ---

function createAuthenticatedClient(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// --- Tool handlers (accept supabase client) ---

async function listGoals(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
}

async function saveGoal(
  supabase: SupabaseClient,
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
    const { id, ...updates } = params;
    const { data, error } = await supabase
      .from("goals")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  if (!params.name || !params.unit || params.target_value === undefined) {
    throw new Error("name, unit, and target_value are required to create a goal");
  }

  const { data: existing } = await supabase
    .from("goals")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("goals")
    .insert({
      name: params.name,
      unit: params.unit,
      target_value: params.target_value,
      goal_type: params.goal_type ?? "food",
      direction: params.direction ?? "max",
      sort_order: nextOrder,
      user_id: user!.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteGoal(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

async function logEntry(
  supabase: SupabaseClient,
  params: {
    type: "food" | "water" | "weight";
    food_name?: string;
    values?: { goal_id: string; value: number }[];
    amount?: number;
    logged_at?: string;
  }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const loggedAt = params.logged_at ?? new Date().toISOString();
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
    const { data: goals, error: goalsError } = await supabase
      .from("goals")
      .select("id")
      .eq("goal_type", params.type)
      .limit(1);
    if (goalsError) throw new Error(goalsError.message);
    if (!goals || goals.length === 0) {
      throw new Error(`No ${params.type} goal found. Create a ${params.type} goal first.`);
    }
    foodName = params.type === "water" ? "Water" : "Weight";
    values = [{ goal_id: goals[0].id, value: params.amount }];
  }

  const { data: foodLog, error: logError } = await supabase
    .from("food_logs")
    .insert({ food_name: foodName, logged_at: loggedAt, user_id: user!.id })
    .select()
    .single();
  if (logError) throw new Error(logError.message);

  if (values.length > 0) {
    const valueRows = values.map((v) => ({
      food_log_id: foodLog.id,
      goal_id: v.goal_id,
      value: v.value,
    }));
    const { error: valError } = await supabase.from("food_log_values").insert(valueRows);
    if (valError) throw new Error(valError.message);
  }

  const { data, error } = await supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .eq("id", foodLog.id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function getLogs(
  supabase: SupabaseClient,
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
      return getDaily(supabase, params.date, params.timezone_offset);
    case "suggestions":
      return getSuggestions(supabase, params.timezone_offset);
    case "dashboard":
      return getDashboard(supabase, params.from, params.to, params.timezone_offset);
    default:
      throw new Error(`Unknown view: ${params.view}`);
  }
}

async function getDaily(supabase: SupabaseClient, date?: string, timezoneOffset?: number) {
  let query = supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .order("logged_at", { ascending: false });

  if (date) {
    const offsetMinutes = timezoneOffset ?? 0;
    const startLocal = new Date(`${date}T00:00:00`);
    const startUTC = new Date(startLocal.getTime() + offsetMinutes * 60000);
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
    query = query
      .gte("logged_at", startUTC.toISOString())
      .lt("logged_at", endUTC.toISOString());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function getSuggestions(supabase: SupabaseClient, timezoneOffset?: number) {
  const offsetMinutes = timezoneOffset ?? 0;
  const now = new Date();
  const localNow = new Date(now.getTime() - offsetMinutes * 60000);
  const currentHour = localNow.getUTCHours();

  const todayLocal = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate())
  );
  const todayStartUTC = new Date(todayLocal.getTime() + offsetMinutes * 60000);
  const thirtyDaysAgo = new Date(todayStartUTC.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .lt("logged_at", todayStartUTC.toISOString())
    .gte("logged_at", thirtyDaysAgo.toISOString())
    .order("logged_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const filtered = (data ?? []).filter((log: { logged_at: string }) => {
    const logTime = new Date(log.logged_at);
    const logLocal = new Date(logTime.getTime() - offsetMinutes * 60000);
    const logHour = logLocal.getUTCHours();
    const diff = Math.abs(logHour - currentHour);
    const circularDiff = Math.min(diff, 24 - diff);
    return circularDiff <= 3;
  });

  const seen = new Set<string>();
  const unique = filtered.filter((log: { food_name: string }) => {
    const key = log.food_name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 3);
}

async function getDashboard(
  supabase: SupabaseClient,
  from?: string,
  to?: string,
  timezoneOffset?: number
) {
  if (!from || !to) throw new Error("from and to dates are required for dashboard view");

  const offsetMinutes = timezoneOffset ?? 0;

  const [goalsResult, logsResult] = await Promise.all([
    supabase.from("goals").select("*").order("sort_order"),
    supabase
      .from("food_logs")
      .select("id, logged_at, food_log_values(goal_id, value)")
      .gte(
        "logged_at",
        new Date(new Date(`${from}T00:00:00`).getTime() + offsetMinutes * 60000).toISOString()
      )
      .lt(
        "logged_at",
        new Date(
          new Date(`${to}T00:00:00`).getTime() + offsetMinutes * 60000 + 24 * 60 * 60 * 1000
        ).toISOString()
      ),
  ]);

  if (goalsResult.error) throw new Error(goalsResult.error.message);
  if (logsResult.error) throw new Error(logsResult.error.message);

  const goals = goalsResult.data;
  const foodLogs = logsResult.data;

  const aggregated: Record<string, Record<string, number>> = {};
  for (const goal of goals ?? []) {
    aggregated[goal.id] = {};
  }
  for (const log of foodLogs ?? []) {
    const logUTC = new Date(log.logged_at);
    const logLocal = new Date(logUTC.getTime() - offsetMinutes * 60000);
    const date = logLocal.toISOString().split("T")[0];
    for (const val of log.food_log_values) {
      if (!aggregated[val.goal_id]) aggregated[val.goal_id] = {};
      aggregated[val.goal_id][date] = (aggregated[val.goal_id][date] || 0) + val.value;
    }
  }

  return { goals, aggregated };
}

async function editLog(
  supabase: SupabaseClient,
  params: {
    action: "update" | "delete";
    id: string;
    food_name?: string;
    logged_at?: string;
    values?: { goal_id: string; value: number }[];
  }
) {
  if (params.action === "delete") {
    const { error } = await supabase.from("food_logs").delete().eq("id", params.id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  if (params.food_name || params.logged_at) {
    const updates: Record<string, string> = {};
    if (params.food_name) updates.food_name = params.food_name;
    if (params.logged_at) updates.logged_at = params.logged_at;
    const { error } = await supabase.from("food_logs").update(updates).eq("id", params.id);
    if (error) throw new Error(error.message);
  }

  if (params.values && Array.isArray(params.values)) {
    await supabase.from("food_log_values").delete().eq("food_log_id", params.id);
    if (params.values.length > 0) {
      const valueRows = params.values.map((v) => ({
        food_log_id: params.id,
        goal_id: v.goal_id,
        value: v.value,
      }));
      const { error } = await supabase.from("food_log_values").insert(valueRows);
      if (error) throw new Error(error.message);
    }
  }

  const { data, error } = await supabase
    .from("food_logs")
    .select("*, food_log_values(*)")
    .eq("id", params.id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// --- Tool definitions (same schemas as local MCP server) ---

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

// --- MCP Server factory ---

function createMcpServer(supabase: SupabaseClient) {
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
          result = await logEntry(supabase, args as Parameters<typeof logEntry>[1]);
          break;
        case "get_logs":
          result = await getLogs(supabase, args as Parameters<typeof getLogs>[1]);
          break;
        case "edit_log":
          result = await editLog(supabase, args as Parameters<typeof editLog>[1]);
          break;
        case "list_goals":
          result = await listGoals(supabase);
          break;
        case "save_goal":
          result = await saveGoal(supabase, args as Parameters<typeof saveGoal>[1]);
          break;
        case "delete_goal":
          result = await deleteGoal(supabase, (args as { id: string }).id);
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

// --- Route handlers ---

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Missing Authorization header" }, id: null },
      { status: 401 }
    );
  }

  const supabase = createAuthenticatedClient(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Invalid or expired token" }, id: null },
      { status: 401 }
    );
  }

  const server = createMcpServer(supabase);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return response;
}

export async function GET() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405 }
  );
}

export async function DELETE() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405 }
  );
}
