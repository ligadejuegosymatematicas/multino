const PROFILE_KEY = "multino.profile.v1";
const HISTORY_KEY = "multino.history.v1";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export class LocalProfileStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  load() {
    return safeParse(this.storage?.getItem(PROFILE_KEY), { nick: "" });
  }

  save({ nick }) {
    const profile = { nick: String(nick ?? "").trim() };
    this.storage?.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }
}

export class LocalMatchHistoryStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  list() {
    return safeParse(this.storage?.getItem(HISTORY_KEY), []);
  }

  save(record) {
    const next = [structuredClone(record), ...this.list()].slice(0, 50);
    this.storage?.setItem(HISTORY_KEY, JSON.stringify(next));
    return record;
  }
}

