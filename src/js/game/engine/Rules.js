import { CAPABILITY_IMPLEMENTED } from "../../utils/constants.js";

export const RULES_CAPABILITIES = Object.freeze({
  turnPlayRequirement: CAPABILITY_IMPLEMENTED,
  connectionCompatibility: CAPABILITY_IMPLEMENTED,
  randomDeal: CAPABILITY_IMPLEMENTED,
  legalMoveChoice: CAPABILITY_IMPLEMENTED,
  passingAndBlocking: CAPABILITY_IMPLEMENTED,
  specialDoubleEligibility: CAPABILITY_IMPLEMENTED,
  mainLineTopology: CAPABILITY_IMPLEMENTED,
  branchTopology: CAPABILITY_IMPLEMENTED,
});

// El reglamento completo no está listo mientras bonificación y resultado sigan pendientes.
export const RULES_READY = false;
export const RULES_SPECIFICATION_COMPLETE = true;
