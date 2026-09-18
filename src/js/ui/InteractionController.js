import {
  applyTurnAction,
  getAvailableActions,
  getLegalTargetsForDomino,
  getStrategicDecisionGroups,
  projectGraphView,
  projectPortView,
  projectTraditionalView,
} from "../game/index.js";

function targetsMatch(actionTarget, projectedTarget) {
  if (actionTarget.kind === "START") {
    return projectedTarget.kind === "START";
  }
  return (
    actionTarget.kind === "OPEN_END" &&
    actionTarget.placementId === projectedTarget.placementId &&
    actionTarget.portId === projectedTarget.portId
  );
}

/** Frontera entre intención visual y acciones reglamentarias canónicas. */
export class InteractionController {
  constructor({
    initialState,
    requestAction = applyTurnAction,
    onChange = () => {},
  } = {}) {
    if (!initialState || typeof initialState !== "object") {
      throw new TypeError("initialState debe ser un snapshot.");
    }
    if (typeof requestAction !== "function" || typeof onChange !== "function") {
      throw new TypeError("requestAction y onChange deben ser funciones.");
    }

    this.state = initialState;
    this.selectedDominoId = null;
    this.inspectedStructureId = null;
    this.inspectedPlacementId = null;
    this.requestAction = requestAction;
    this.onChange = onChange;
  }

  getState() {
    return this.state;
  }

  getPresentation() {
    const view = projectGraphView(this.state, this.state.currentPlayerId);
    const availableActions = getAvailableActions(this.state);
    const selectedLegalTargets = this.selectedDominoId
      ? getLegalTargetsForDomino(
          this.state,
          this.state.currentPlayerId,
          this.selectedDominoId,
        )
      : [];
    const strategicDecisionGroups = this.selectedDominoId
      ? getStrategicDecisionGroups(
          this.state,
          this.state.currentPlayerId,
          this.selectedDominoId,
        )
      : [];

    return {
      view,
      portView: projectPortView(
        this.state,
        this.state.currentPlayerId,
      ),
      traditionalView: projectTraditionalView(
        this.state,
        this.state.currentPlayerId,
      ),
      selectedDominoId: this.selectedDominoId,
      inspectedStructureId: this.inspectedStructureId,
      inspectedPlacementId: this.inspectedPlacementId,
      selectedLegalTargets,
      strategicDecisionGroups,
      canPass: availableActions.some((action) => action.type === "PASS"),
      isFinished: this.state.phase === "finished",
    };
  }

  start() {
    this.#emitChange();
  }

  selectDomino(dominoId) {
    if (this.state.phase === "finished") {
      throw new Error("La ronda ya terminó.");
    }
    const view = projectGraphView(this.state, this.state.currentPlayerId);
    if (!view.hand.some((domino) => domino.dominoId === dominoId)) {
      throw new Error("La ficha no pertenece a la mano actual.");
    }
    this.selectedDominoId =
      this.selectedDominoId === dominoId ? null : dominoId;
    this.#emitChange();
  }

  inspectPlacement(placementId) {
    const view = projectGraphView(this.state, this.state.currentPlayerId);
    const placement = view.topology.placements.find(
      (candidate) => candidate.placementId === placementId,
    );
    if (!placement) {
      throw new Error("La ficha jugada no existe en el grafo actual.");
    }
    const structureId = placement.familyId ?? "main";
    const isActive = this.inspectedStructureId === structureId;
    this.inspectedStructureId = isActive ? null : structureId;
    this.inspectedPlacementId = isActive ? null : placementId;
    this.#emitChange();
    return this.inspectedStructureId;
  }

  inspectStructure(structureId) {
    const view = projectGraphView(this.state, this.state.currentPlayerId);
    const exists = structureId === "main" || view.topology.branchFamilies.some(
      (family) => family.id === structureId,
    );
    if (!exists) {
      throw new Error("La estructura no existe en el grafo actual.");
    }
    const isActive = this.inspectedStructureId === structureId;
    this.inspectedStructureId = isActive ? null : structureId;
    this.inspectedPlacementId = null;
    this.#emitChange();
    return this.inspectedStructureId;
  }

  clearInspection() {
    if (this.inspectedStructureId === null) {
      return;
    }
    this.inspectedStructureId = null;
    this.inspectedPlacementId = null;
    this.#emitChange();
  }

  submitTarget(target) {
    if (!this.selectedDominoId) {
      throw new Error("Selecciona una ficha antes de elegir destino.");
    }
    const action = getAvailableActions(this.state).find(
      (candidate) =>
        candidate.type === "PLAY_DOMINO" &&
        candidate.dominoId === this.selectedDominoId &&
        targetsMatch(candidate.target, target),
    );
    if (!action) {
      throw new Error("Ese destino no es legal para la ficha seleccionada.");
    }
    return this.#applyAction(action);
  }

  pass() {
    const action = getAvailableActions(this.state).find(
      (candidate) => candidate.type === "PASS",
    );
    if (!action) {
      throw new Error("PASS no está disponible en este turno.");
    }
    return this.#applyAction(action);
  }

  #applyAction(action) {
    const nextState = this.requestAction(this.state, action);
    this.state = nextState;
    this.selectedDominoId = null;
    this.inspectedStructureId = null;
    this.inspectedPlacementId = null;
    this.#emitChange();
    return nextState;
  }

  #emitChange() {
    this.onChange(this.getPresentation());
  }
}
