import { assertNonEmptyId } from "../../utils/helpers.js";

export function createTeam({ id, playerIds = [], displayName = null }) {
  assertNonEmptyId(id, "team.id");

  if (!Array.isArray(playerIds)) {
    throw new TypeError("team.playerIds debe ser un array.");
  }

  return {
    id,
    playerIds: [...playerIds],
    displayName,
  };
}

