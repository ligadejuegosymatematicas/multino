/**
 * Adaptador de cliente inyectable. Recibe una instancia pública de Supabase;
 * nunca acepta service_role ni snapshots completos enviados por el navegador.
 */
export class SupabaseGateway {
  constructor({
    supabaseClient,
    actionEndpoint = "game-action",
    lobbyEndpoint = "room-lobby",
  } = {}) {
    if (!supabaseClient?.auth || !supabaseClient?.functions) {
      throw new TypeError("Se requiere un cliente público de Supabase.");
    }
    this.client = supabaseClient;
    this.actionEndpoint = actionEndpoint;
    this.lobbyEndpoint = lobbyEndpoint;
  }

  async ensureAnonymousIdentity() {
    const { data: sessionData } = await this.client.auth.getSession();
    if (sessionData?.session?.user) return sessionData.session.user;
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  }

  async sendIntent({ roomCode, expectedVersion, intent }) {
    return this.#invoke(this.actionEndpoint, {
      roomCode,
      expectedVersion,
      intent,
    });
  }

  async sendLobbyIntent(intent) {
    return this.#invoke(this.lobbyEndpoint, intent);
  }

  async syncMatch(roomCode) {
    return this.sendIntent({
      roomCode,
      expectedVersion: null,
      intent: { type: "SYNC_MATCH" },
    });
  }

  async listRecentMatches(limit = 10) {
    const { data: authData, error: authError } = await this.client.auth.getUser();
    if (authError) throw authError;
    const { data, error } = await this.client
      .from("match_players")
      .select("match_id,nick,team_id,matches(started_at,finished_at,winner_team_id,termination_reason,public_state)")
      .eq("user_id", authData.user.id)
      .order("match_id", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  subscribeRoom(roomId, onVersion) {
    const channel = this.client.channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        ({ new: next }) => onVersion(next.version, { scope: "room" }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `room_id=eq.${roomId}` },
        ({ new: next }) => onVersion(next.version, { scope: "match" }),
      )
      .subscribe();
    return () => this.client.removeChannel(channel);
  }

  async #invoke(endpoint, body) {
    const { data, error } = await this.client.functions.invoke(
      endpoint,
      { body },
    );
    if (!error) return data;
    let details = null;
    try {
      details = await error.context?.json?.();
    } catch {
      // El SDK conserva igualmente el mensaje de transporte.
    }
    throw Object.assign(
      new Error(details?.message ?? details?.code ?? error.message),
      { code: details?.code ?? error.name, details },
    );
  }
}
