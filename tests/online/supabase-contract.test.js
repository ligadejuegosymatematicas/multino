import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/202609210001_online_alpha.sql",
  import.meta.url,
);

test("la migración define el modelo mínimo y RLS default-deny", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of [
    "profiles",
    "rooms",
    "room_seats",
    "matches",
    "match_players",
    "moves",
    "match_state_private",
  ]) {
    assert.match(sql, new RegExp(`create table public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.doesNotMatch(sql, /create policy[^;]+match_state_private/is);
  assert.match(sql, /STALE_VERSION/);
  assert.match(sql, /for update/);
  assert.match(sql, /revoke all on function public\.commit_game_transition/);
});

test("service_role queda únicamente dentro de funciones servidor", async () => {
  const gateway = await readFile(
    new URL("../../src/js/online/SupabaseGateway.js", import.meta.url),
    "utf8",
  );
  const action = await readFile(
    new URL("../../supabase/functions/game-action/index.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(gateway, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(action, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(action, /auth\.getUser/);
  assert.match(action, /commit_game_transition/);
});

test("la función servidor reutiliza el motor y no acepta snapshots del cliente", async () => {
  const action = await readFile(
    new URL("../../supabase/functions/game-action/index.ts", import.meta.url),
    "utf8",
  );
  const shared = await readFile(
    new URL("../../supabase/functions/_shared/authoritative-action.js", import.meta.url),
    "utf8",
  );
  assert.match(shared, /src\/js\/game\/index\.js/);
  assert.match(action, /const \{ roomCode, expectedVersion, intent \}/);
  assert.doesNotMatch(action, /request\.json\(\).*gameState/s);
  assert.match(shared, /applyTurnAction/);
});
