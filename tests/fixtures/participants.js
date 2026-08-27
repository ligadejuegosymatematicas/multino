export function createValidParticipantInput() {
  return {
    players: [
      { id: "P1", teamId: "A" },
      { id: "P2", teamId: "B" },
      { id: "P3", teamId: "A" },
      { id: "P4", teamId: "B" },
    ],
    teams: [
      { id: "A", playerIds: ["P1", "P3"] },
      { id: "B", playerIds: ["P2", "P4"] },
    ],
    seating: {
      counterclockwisePlayerIds: ["P1", "P2", "P3", "P4"],
    },
  };
}

