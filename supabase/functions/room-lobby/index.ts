import { createClient } from "npm:@supabase/supabase-js@2";
import { getSupabaseServerEnvironment } from "../_shared/supabase-env.ts";

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "content-type": "application/json",
};

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return [...bytes].map((value) => alphabet[value % alphabet.length]).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const { url, publishableKey, secretKey } = getSupabaseServerEnvironment();
    if (!url || !publishableKey || !secretKey) {
      return response(503, { code: "SERVER_NOT_CONFIGURED" });
    }
    const authorization = request.headers.get("authorization") ?? "";
    const auth = createClient(url, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await auth.auth.getUser();
    if (authError || !authData.user) return response(401, { code: "AUTH_REQUIRED" });
    const admin = createClient(url, secretKey, { auth: { persistSession: false } });
    const body = await request.json();
    const allowedTypes = new Set(["CREATE_ROOM", "JOIN_ROOM", "GET_ROOM", "SET_SEAT_CONTROL"]);
    if (!allowedTypes.has(body.type)) return response(400, { code: "UNKNOWN_INTENT" });
    const nick = String(body.nick ?? "").trim().slice(0, 24);
    if ((body.type === "CREATE_ROOM" || body.type === "JOIN_ROOM") && !nick) {
      return response(400, { code: "NICK_REQUIRED" });
    }
    if (body.type === "CREATE_ROOM" || body.type === "JOIN_ROOM") {
      await admin.from("profiles").upsert({ id: authData.user.id, nick });
    }

    let code = String(body.roomCode ?? "").toUpperCase();
    if (body.type === "CREATE_ROOM") {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        code = roomCode();
        const { error } = await admin.rpc("create_private_room", {
          p_code: code,
          p_host_user_id: authData.user.id,
          p_nick: nick,
        });
        if (!error) break;
        if (attempt === 5) return response(500, { code: "ROOM_CODE_EXHAUSTED" });
      }
    } else if (body.type === "JOIN_ROOM") {
      const { error } = await admin.rpc("join_private_room", {
        p_code: code,
        p_user_id: authData.user.id,
        p_nick: nick,
      });
      if (error) return response(409, { code: "ROOM_FULL_OR_STARTED" });
    }

    const { data: room } = await admin.from("rooms")
      .select("id,code,host_user_id,status,version,room_seats(*)")
      .eq("code", code)
      .single();
    if (!room) return response(404, { code: "ROOM_NOT_FOUND" });
    if (!room.room_seats.some((seat) => seat.user_id === authData.user.id)) {
      return response(403, { code: "NOT_ROOM_MEMBER" });
    }
    if (body.type === "SET_SEAT_CONTROL") {
      const { error } = await admin.rpc("set_room_seat_control", {
        p_room_id: room.id,
        p_host_user_id: authData.user.id,
        p_seat_index: body.seatIndex,
        p_control_type: body.controlType,
      });
      if (error) return response(409, { code: error.message });
      const { data: refreshed } = await admin.from("rooms")
        .select("id,code,host_user_id,status,version,room_seats(*)")
        .eq("id", room.id)
        .single();
      return response(200, refreshed);
    }
    return response(200, room);
  } catch (error) {
    return response(400, { code: "INVALID_REQUEST", message: error?.message });
  }
});
