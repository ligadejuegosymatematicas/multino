import { getRuntimeConfig } from "../config/RuntimeConfig.js";
import { SupabaseGateway } from "./SupabaseGateway.js";

const SUPABASE_ESM_URL =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export async function createBrowserSupabaseGateway({
  runtimeConfig = getRuntimeConfig(),
  importSupabase = () => import(SUPABASE_ESM_URL),
} = {}) {
  if (!runtimeConfig.onlineEnabled) {
    throw new Error("El modo online todavía no está configurado.");
  }
  const { createClient } = await importSupabase();
  const client = createClient(
    runtimeConfig.supabaseUrl,
    runtimeConfig.supabasePublicKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
  return new SupabaseGateway({ supabaseClient: client });
}
