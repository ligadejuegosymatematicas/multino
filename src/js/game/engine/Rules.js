import {
  CAPABILITY_IMPLEMENTED,
  SPECIFIED_NOT_IMPLEMENTED,
} from "../../utils/constants.js";

export const RULES_CAPABILITIES = Object.freeze({
  turnPlayRequirement: SPECIFIED_NOT_IMPLEMENTED,
  connectionCompatibility: CAPABILITY_IMPLEMENTED,
  randomDeal: CAPABILITY_IMPLEMENTED,
  legalMoveChoice: CAPABILITY_IMPLEMENTED,
  passingAndBlocking: SPECIFIED_NOT_IMPLEMENTED,
  specialDoubleEligibility: CAPABILITY_IMPLEMENTED,
  mainLineTopology: CAPABILITY_IMPLEMENTED,
  branchTopology: CAPABILITY_IMPLEMENTED,
});

export const RULES_READY = false;
export const RULES_SPECIFICATION_COMPLETE = true;
