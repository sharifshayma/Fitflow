import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aeebalwkjbswkhciiksh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yrhztjt0fE6vEYpBr9SauQ_QFN77H2t";

let cachedClient: SupabaseClient | null = null;

export async function getClient(): Promise<SupabaseClient> {
  if (cachedClient) return cachedClient;

  const email = process.env.FITFLOW_EMAIL;
  const password = process.env.FITFLOW_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing FITFLOW_EMAIL or FITFLOW_PASSWORD environment variables. " +
        "Set them in your Claude Code MCP server config."
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`FitFlow sign-in failed: ${error.message}`);
  }

  cachedClient = supabase;
  return supabase;
}
