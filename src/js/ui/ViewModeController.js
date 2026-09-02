export const BOARD_VIEW_MODES = Object.freeze({
  GRAPH: "graph",
  TRADITIONAL: "traditional",
});

const VALID_MODES = new Set(Object.values(BOARD_VIEW_MODES));

/** Preferencia efímera de UI; no recibe ni modifica el snapshot. */
export class ViewModeController {
  constructor({
    initialMode = BOARD_VIEW_MODES.TRADITIONAL,
    onChange = () => {},
  } = {}) {
    if (!VALID_MODES.has(initialMode)) {
      throw new TypeError(`Modo visual desconocido: ${String(initialMode)}.`);
    }
    if (typeof onChange !== "function") {
      throw new TypeError("onChange debe ser una función.");
    }
    this.mode = initialMode;
    this.onChange = onChange;
  }

  getMode() {
    return this.mode;
  }

  setMode(mode) {
    if (!VALID_MODES.has(mode)) {
      throw new TypeError(`Modo visual desconocido: ${String(mode)}.`);
    }
    if (mode === this.mode) {
      return this.mode;
    }
    this.mode = mode;
    this.onChange(mode);
    return this.mode;
  }
}
