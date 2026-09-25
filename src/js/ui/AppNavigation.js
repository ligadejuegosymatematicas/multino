const KEY = "multinoNavigation";
const sameRoute = (a, b) => a?.screen === b?.screen &&
  (a?.roomCode ?? "") === (b?.roomCode ?? "");

export const EXIT_COPY = Object.freeze({
  online: "Tu asiento seguirá reservado y podrás volver a entrar mientras la partida continúe.",
  local: "El progreso de esta ronda local no se guarda. Si sales, no podrás retomarla.",
});

export function getExitPrompt(session, kind) {
  if (!session?.round || session.round.isFinished) return null;
  return EXIT_COPY[kind];
}

/** Browser Back restores the existing entry before asking. Cancel never pushes
 * another entry; acceptance traverses to the original destination exactly once.
 * State contains navigation only, never identity, hands or game snapshots. */
export class AppNavigation {
  constructor({ history, location, events, confirmExit, getPrompt, onRoute,
    exitRoute = () => null }) {
    Object.assign(this, { history, location, events, confirmExit, getPrompt, onRoute, exitRoute });
    this.current = history.state?.[KEY] ?? {
      index: 0, route: { screen: "entry" },
    };
    this.restoring = false;
    this.pending = null;
    this.allowed = null;
    this.listener = (event) => this.handlePop(event.state?.[KEY]);
    events.addEventListener("popstate", this.listener);
  }

  get restoredRoute() { return this.history.state?.[KEY]?.route ?? null; }

  init() {
    this.write(this.current, true);
  }

  write(entry, replace) {
    const url = new URL(this.location.href);
    if (entry.route.roomCode) url.searchParams.set("room", entry.route.roomCode);
    else url.searchParams.delete("room");
    this.history[replace ? "replaceState" : "pushState"](
      { ...this.history.state, [KEY]: entry }, "", url,
    );
  }

  record(route, { replace = false } = {}) {
    if (sameRoute(route, this.current.route)) return;
    this.current = {
      index: this.current.index + (replace ? 0 : 1), route: { ...route },
    };
    this.write(this.current, replace);
  }

  back() {
    if (this.pending || this.restoring) return;
    if (this.current.index > 0) this.history.back();
    else this.onRoute({ screen: "entry" });
  }

  async handlePop(target) {
    if (!target) return; // Outside this app's history: never trap the user.
    if (this.restoring) {
      if (target.index !== this.current.index) {
        this.history.go(this.current.index - target.index);
        return;
      }
      this.restoring = false;
      const pending = this.pending;
      const accepted = await this.confirmExit(pending.prompt);
      this.pending = null;
      if (accepted) {
        this.allowed = { ...pending.target,
          exitRoute: this.exitRoute(this.current.route) };
        this.history.go(pending.target.index - this.current.index);
      }
      return;
    }
    if (this.pending) {
      // A second Back while the dialog is open is restored, not another prompt.
      if (target.index !== this.current.index) {
        this.history.go(this.current.index - target.index);
      }
      return;
    }
    const allowed = this.allowed?.index === target.index;
    const exitRoute = allowed ? this.allowed.exitRoute : null;
    this.allowed = null;
    const prompt = !allowed && !sameRoute(target.route, this.current.route)
      ? this.getPrompt() : null;
    if (prompt) {
      this.pending = { target, prompt };
      this.restoring = true;
      this.history.go(this.current.index - target.index);
      return;
    }
    this.current = target;
    // A confirmed online exit leaves the screen, not the room. Replace the
    // reached entry rather than pushing a new one (no Back/confirmation loop).
    if (exitRoute) this.record(exitRoute, { replace: true });
    await this.onRoute(this.current.route);
  }

  dispose() { this.events.removeEventListener("popstate", this.listener); }
}
