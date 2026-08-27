import { assertNonEmptyId } from "../../utils/helpers.js";

export function createPlayer({ id, teamId = null, displayName = null }) {
  assertNonEmptyId(id, "player.id");

  return {
    id,
    teamId,
    displayName,
  };
}

