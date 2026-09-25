import { getRuntimeConfig } from "../config/RuntimeConfig.js";
import { SupabaseGateway } from "./SupabaseGateway.js";

const SUPABASE_ESM_URL =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Navigation replaces screen controllers, not the browser's Auth client.
// Share even an in-flight initialization; a failed import may be retried by the user.
export function createBrowserGatewayProvider(createGateway = createBrowserSupabaseGateway) {
  let pending = null;
  return () => {
    if (!pending) {
      pending = Promise.resolve().then(createGateway).catch((error) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
}

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
