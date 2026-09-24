import test from "node:test";
import assert from "node:assert/strict";
import { getRoundActionsPresentation, getRoundResultPresentation } from "../../src/js/ui/ScorePanel.js";

for (const sessionKind of ["LOCAL", "ONLINE"]) {
  test(`${sessionKind}: final actions wait for scoring/settle and are absent during PLAYING`, () => {
    for (const args of [{ isFinished: false, deferred: false }, { isFinished: true, deferred: true }]) {
      const result = getRoundActionsPresentation({ ...args, sessionKind });
      assert.equal(result.visible, false);
      assert.equal(result.canPlayAgain, false);
      assert.equal(result.canGoHome, false);
    }
    const final = getRoundActionsPresentation({ isFinished: true, deferred: false, sessionKind });
    assert.equal(final.canGoHome, true);
    assert.equal(final.canPlayAgain, sessionKind === "LOCAL");
    assert.equal(final.canConfigure, sessionKind === "LOCAL");
  });
}

test("online does not promise unsupported rematch or seat reordering", () => {
  const result = getRoundActionsPresentation({ isFinished: true, sessionKind: "ONLINE" });
  assert.equal(result.notice, "Para otra partida online, crea una nueva sala y comparte su código.");
  assert.equal(result.canPlayAgain, false);
  assert.equal(result.canConfigure, false);
});

test("Local/Online share winner/tie, scores, reasons and bonus without repeating move points", () => {
  for (const reason of ["EMPTY_HAND", "BLOCKED"]) {
    for (const isTie of [false, true]) {
      const result = getRoundResultPresentation({
        participants: { teams: [
          { teamId: "A", displayName: "Equipo A", score: isTie ? 8 : 9 },
          { teamId: "B", displayName: "Equipo B", score: 8 },
        ] },
        roundStatus: { roundResult: { reason, isTie, winnerTeamId: isTie ? null : "A",
          traditionalWinnerTeamId: "B", finalBonus: 3 } },
      });
      assert.equal(result.headline, isTie ? "EMPATE FINAL" : "EQUIPO A GANA");
      assert.equal(result.scoreLine, isTie ? "8 – 8" : "9 – 8");
      assert.equal(result.finalBonus, 3);
      assert.ok(result.reason);
      assert.equal(result.scoreAwarded, undefined);
    }
  }
});
