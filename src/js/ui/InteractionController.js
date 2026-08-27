/**
 * Frontera futura entre eventos de UI y acciones de dominio.
 * No conecta eventos todavía porque no existen acciones jugables formalizadas.
 */
export class InteractionController {
  constructor({ requestAction }) {
    if (typeof requestAction !== "function") {
      throw new TypeError("requestAction debe ser una función.");
    }

    this.requestAction = requestAction;
  }

  submitIntent(intent) {
    return this.requestAction(intent);
  }
}

