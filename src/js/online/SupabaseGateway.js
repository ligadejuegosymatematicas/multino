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
    const { data, error } = await this.client.functions.invoke(
      this.actionEndpoint,
      { body: { roomCode, expectedVersion, intent } },
    );
    if (error) throw error;
    return data;
  }

  async sendLobbyIntent(intent) {
    const { data, error } = await this.client.functions.invoke(
      this.lobbyEndpoint,
      { body: intent },
    );
    if (error) throw error;
    return data;
  }

  async listRecentMatches(limit = 10) {
    const { data, error } = await this.client
      .from("match_players")
      .select("match_id,nick,team_id,matches(started_at,finished_at,winner_team_id,termination_reason,public_state)")
      .not("user_id", "is", null)
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
        ({ new: next }) => onVersion(next.version),
      )
      .subscribe();
    return () => this.client.removeChannel(channel);
  }
}
