function projectKey(dictionaryName: string, legacyName: string) {
  const dictionary = Deno.env.get(dictionaryName);
  if (dictionary) {
    try {
      const parsed = JSON.parse(dictionary);
      const candidate = parsed?.default ?? Object.values(parsed ?? {})[0];
      if (typeof candidate === "string" && candidate.length > 0) return candidate;
    } catch {
      // Las variables legacy siguen disponibles en proyectos compatibles.
    }
  }
  return Deno.env.get(legacyName) ?? "";
}

export function getSupabaseServerEnvironment() {
  return Object.freeze({
    url: Deno.env.get("SUPABASE_URL") ?? "",
    publishableKey: projectKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"),
    secretKey: projectKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"),
  });
}
