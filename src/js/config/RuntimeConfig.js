export function getRuntimeConfig() {
  const source = globalThis.MULTINO_RUNTIME_CONFIG ?? {};
  const supabaseUrl = String(source.supabaseUrl ?? "").trim();
  const supabasePublicKey = String(source.supabasePublicKey ?? "").trim();
  return Object.freeze({
    supabaseUrl,
    supabasePublicKey,
    onlineEnabled: /^https:\/\/.+\.supabase\.co$/.test(supabaseUrl) &&
      supabasePublicKey.length > 20,
  });
}
