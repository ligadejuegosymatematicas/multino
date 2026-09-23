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
  assert.match(sql, /grant select on table public\.rooms to authenticated/);
  assert.match(sql, /revoke all on table public\.match_state_private from public, anon, authenticated/);
  assert.match(sql, /alter publication supabase_realtime add table public\.rooms/);
});

test("los reclamos concurrentes son privados y no bloqueantes", async () => {
  const claimSql = await readFile(
    new URL("../../supabase/migrations/202609210005_match_action_claims.sql", import.meta.url),
    "utf8",
  );
  assert.match(claimSql, /create table public\.match_action_claims/);
  assert.match(claimSql, /enable row level security/);
  assert.match(claimSql, /revoke all on table public\.match_action_claims from public, anon, authenticated/);
  assert.match(claimSql, /on conflict do nothing/);
  assert.match(claimSql, /claim_match_transition/);
});

test("STALE_VERSION usa un conflicto no reintentable por PostgREST", async () => {
  const staleSql = await readFile(
    new URL(
      "../../supabase/migrations/202609220006_nonretryable_stale_version.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(staleSql, /raise sqlstate 'PT409' using message = 'STALE_VERSION'/);
  assert.equal(
    (staleSql.match(/raise sqlstate 'PT409'/g) ?? []).length,
    2,
    "el lock ocupado y la versión obsoleta deben terminar sin reintento",
  );
  assert.doesNotMatch(staleSql, /errcode\s*=\s*'40001'/);
});

test("Realtime publica lobby y versiones de partida sin publicar estado privado", async () => {
  const initial = await readFile(migrationUrl, "utf8");
  const realtime = await readFile(
    new URL("../../supabase/migrations/202609210002_realtime_matches.sql", import.meta.url),
    "utf8",
  );
  assert.match(initial, /add table public\.rooms/);
  assert.match(realtime, /add table public\.matches/);
  assert.doesNotMatch(initial + realtime, /add table public\.match_state_private/);
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
  const environment = await readFile(
    new URL("../../supabase/functions/_shared/supabase-env.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(gateway, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(environment, /SUPABASE_SECRET_KEYS/);
  assert.match(environment, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(action, /getSupabaseServerEnvironment/);
  assert.match(action, /auth\.getUser/);
  assert.match(action, /commit_game_transition/);
  assert.match(action, /createPrivateOnlineState/);
  assert.match(action, /SYNC_MATCH/);
  assert.doesNotMatch(action, /privateHand:/);
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

test("la autoridad entrega fotogramas confirmados sin temporizar la CPU", async () => {
  const action = await readFile(
    new URL("../../supabase/functions/game-action/index.ts", import.meta.url),
    "utf8",
  );
  const shared = await readFile(
    new URL("../../supabase/functions/_shared/authoritative-action.js", import.meta.url),
    "utf8",
  );
  assert.match(action, /presentationFrames/);
  assert.match(action, /intent\.afterSequence/);
  assert.match(shared, /reconstructAuthoritativeFrames/);
  assert.doesNotMatch(action + shared, /setTimeout|sleep\s*\(|delay\s*\(/);
});

test("el deploy manual publica solo game-action sin secretos en el repo", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/deploy-game-action.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /supabase\/setup-cli@v1/);
  assert.match(workflow, /secrets\.SUPABASE_ACCESS_TOKEN/);
  assert.match(workflow, /functions deploy game-action --project-ref/);
  assert.match(workflow, /kefdfpalennsnnfnjwpc/);
  assert.doesNotMatch(workflow, /service.role|SERVICE_ROLE|db push|migration|room-lobby/i);
});
