import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { listGoals, saveGoal, deleteGoal } from "./tools/goals.js";
import { logEntry } from "./tools/log-entry.js";
import { getLogs } from "./tools/get-logs.js";
import { editLog } from "./tools/edit-log.js";

const server = new Server(
  { name: "fitflow", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "log_entry",
      description:
        "Log a food, water, or weight entry. IMPORTANT: Before logging ANY entry, always call list_goals first to discover the user's goals. Each goal has a goal_type (food, water, or weight). For the entry type being logged, find all goals matching that goal_type and provide a value for each in the values array. For food entries: provide food_name and values for ALL food-type goals (e.g. calories, protein, carbs, fats, fiber). When the user describes a meal or sends a photo, estimate nutritional values for every food-type goal. For water entries: provide food_name='Water' and the value for the water-type goal. For weight entries: provide food_name='Weight' and the value for the weight-type goal.",
      inputSchema: {
        type: "object" as const,
        properties: {
          type: {
            type: "string",
            enum: ["food", "water", "weight"],
            description: "Type of entry to log",
          },
          food_name: {
            type: "string",
            description: "Name of the food (required for food type, auto-set for water/weight)",
          },
          values: {
            type: "array",
            items: {
              type: "object",
              properties: {
                goal_id: { type: "string", description: "Goal UUID" },
                value: { type: "number", description: "Numeric value" },
              },
              required: ["goal_id", "value"],
            },
            description: "Goal values (required for food type)",
          },
          amount: {
            type: "number",
            description: "Amount to log (required for water/weight type)",
          },
          logged_at: {
            type: "string",
            description: "ISO 8601 timestamp (defaults to now)",
          },
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
          view: {
            type: "string",
            enum: ["daily", "suggestions", "dashboard"],
            description: "What to retrieve",
          },
          date: {
            type: "string",
            description: "YYYY-MM-DD date for daily view (defaults to today)",
          },
          from: {
            type: "string",
            description: "YYYY-MM-DD start date for dashboard view",
          },
          to: {
            type: "string",
            description: "YYYY-MM-DD end date for dashboard view",
          },
          timezone_offset: {
            type: "number",
            description: "Minutes from UTC (e.g. -300 for EST)",
          },
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
          action: {
            type: "string",
            enum: ["update", "delete"],
            description: "Whether to update or delete the entry",
          },
          id: {
            type: "string",
            description: "UUID of the food log entry",
          },
          food_name: {
            type: "string",
            description: "Updated food name (for update action)",
          },
          logged_at: {
            type: "string",
            description: "Updated timestamp (for update action)",
          },
          values: {
            type: "array",
            items: {
              type: "object",
              properties: {
                goal_id: { type: "string" },
                value: { type: "number" },
              },
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
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "save_goal",
      description:
        "Create or update a health goal. Omit id to create a new goal. Provide id to update an existing one. goal_type can be 'food', 'water', or 'weight'. direction can be 'min' or 'max'.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: {
            type: "string",
            description: "Goal UUID (omit to create new, provide to update)",
          },
          name: {
            type: "string",
            description: "Goal name (e.g. 'Calories', 'Protein')",
          },
          unit: {
            type: "string",
            description: "Unit of measurement (e.g. 'kcal', 'g', 'cups')",
          },
          target_value: {
            type: "number",
            description: "Target value to reach",
          },
          goal_type: {
            type: "string",
            enum: ["food", "water", "weight"],
            description: "Type of goal (default: food)",
          },
          direction: {
            type: "string",
            enum: ["min", "max"],
            description: "Whether to minimize or maximize toward target (default: max)",
          },
        },
      },
    },
    {
      name: "delete_goal",
      description: "Delete a health tracking goal by ID. This also removes all associated log values.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: {
            type: "string",
            description: "Goal UUID to delete",
          },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "log_entry":
        result = await logEntry(args as Parameters<typeof logEntry>[0]);
        break;
      case "get_logs":
        result = await getLogs(args as Parameters<typeof getLogs>[0]);
        break;
      case "edit_log":
        result = await editLog(args as Parameters<typeof editLog>[0]);
        break;
      case "list_goals":
        result = await listGoals();
        break;
      case "save_goal":
        result = await saveGoal(args as Parameters<typeof saveGoal>[0]);
        break;
      case "delete_goal":
        result = await deleteGoal((args as { id: string }).id);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
