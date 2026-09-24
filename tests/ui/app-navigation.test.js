import assert from "node:assert/strict";
import test from "node:test";
import { AppNavigation, EXIT_COPY, getExitPrompt } from "../../src/js/ui/AppNavigation.js";
import { LocalGameSessionController } from "../../src/js/ui/LocalGameSessionController.js";
import { createDefaultSeats } from "../../src/js/game/index.js";

function harness() {
  const events = new EventTarget();
  const location = { href: "https://example.org/multino/" };
  const entries = [{ state: null, url: location.href }];
  let cursor = 0;
  let prompt = null;
  let resolveConfirm;
  let confirmations = 0;
  const routes = [];
  const history = {
    get state() { return entries[cursor].state; },
    replaceState(state, _, url) { entries[cursor] = { state, url: String(url) }; location.href = String(url); },
    pushState(state, _, url) { entries.splice(++cursor); entries.push({ state, url: String(url) }); location.href = String(url); },
    back() { this.go(-1); },
    go(delta) {
      assert.notEqual(delta, 0, "No accidental reload via history.go(0)");
      const next = cursor + delta;
      if (next < 0 || next >= entries.length) return;
      cursor = next;
      location.href = entries[cursor].url;
      const event = new Event("popstate");
      event.state = this.state;
      queueMicrotask(() => events.dispatchEvent(event));
    },
  };
  const nav = new AppNavigation({ history, location, events,
    getPrompt: () => prompt,
    confirmExit: () => { confirmations++; return new Promise(resolve => { resolveConfirm = resolve; }); },
    onRoute: route => routes.push(route),
  });
  nav.init();
  return { nav, history, entries, location, routes,
    setPrompt: value => { prompt = value; },
    confirm: value => resolveConfirm(value),
    get confirmations() { return confirmations; },
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("configuration/online/lobby Back follows finite internal history and room URLs", async () => {
  const h = harness();
  h.nav.record({ screen: "local-setup" });
  h.nav.back(); await flush();
  assert.deepEqual(h.routes.at(-1), { screen: "entry" });
  h.nav.record({ screen: "online-join" });
  h.nav.record({ screen: "online-lobby", roomCode: "ABCDE" });
  assert.match(h.location.href, /\?room=ABCDE$/);
  h.nav.back(); await flush();
  assert.deepEqual(h.routes.at(-1), { screen: "online-join" });
  assert.equal(h.location.href, "https://example.org/multino/");
  h.nav.back(); await flush();
  assert.equal(h.routes.at(-1).screen, "entry");
});

for (const kind of ["local", "online"]) {
  test(`${kind} PLAYING: cancel repeated Back without growing history, then accept`, async () => {
    const h = harness();
    h.nav.record({ screen: `${kind}-join` });
    h.nav.record({ screen: `${kind}-round`, roomCode: kind === "online" ? "ABCDE" : "" });
    h.setPrompt(EXIT_COPY[kind]);
    const length = h.entries.length;
    h.history.back(); await flush();
    assert.equal(h.routes.length, 0);
    h.history.back(); await flush();
    assert.equal(h.confirmations, 1);
    h.confirm(false); await flush();
    assert.equal(h.entries.length, length);
    assert.equal(h.nav.current.route.screen, `${kind}-round`);
    h.nav.back(); await flush(); h.confirm(true); await flush();
    assert.equal(h.routes.at(-1).screen, `${kind}-join`);
    assert.equal(h.entries.length, length);
    assert.equal(h.confirmations, 2);
  });
}

test("FINISHED (including BLOCKED/tie) never asks for abandonment or reactivates a turn", async () => {
  for (const reason of ["EMPTY_HAND", "BLOCKED"]) {
    const h = harness();
    h.nav.record({ screen: "online-join" });
    h.nav.record({ screen: "online-round", roomCode: "ABCDE" });
    h.setPrompt(getExitPrompt({ round: { isFinished: true, reason } }, "online"));
    h.nav.back(); await flush();
    assert.equal(h.confirmations, 0);
    assert.equal(h.routes.at(-1).screen, "online-join");
  }
});

test("refresh keeps navigation and room code without storing private match data", () => {
  const h = harness();
  h.nav.record({ screen: "online-round", roomCode: "ABCDE" });
  const nav = new AppNavigation({ history: h.history, location: h.location, events: new EventTarget() });
  assert.deepEqual(nav.restoredRoute, { screen: "online-round", roomCode: "ABCDE" });
  nav.init();
  assert.equal(h.entries.length, 2);
  assert.doesNotMatch(JSON.stringify(h.history.state), /hand|userId|token|seatId/);
});

test("local exit cancels scheduled work, drops nonpersisted round, preserves configuration", () => {
  const cancelled = [];
  const session = new LocalGameSessionController({
    seats: createDefaultSeats(), randomSourceFactory: () => () => .999999,
    scheduleCpuTask: () => 123, cancelCpuTask: id => cancelled.push(id),
  });
  session.startNewGame();
  const before = session.getPresentation();
  assert.equal(getExitPrompt(before, "local"), EXIT_COPY.local);
  session.leaveRound();
  assert.equal(session.getRoundState(), null);
  assert.deepEqual(session.getPresentation().config, before.config);
  assert.deepEqual(session.getPresentation().seats, before.seats);
  assert.ok(cancelled.includes(123));
  assert.equal(getExitPrompt(session.getPresentation(), "local"), null);
});
