import {
  CAPABILITY_IMPLEMENTED,
  SPECIFIED_NOT_IMPLEMENTED,
} from "../../utils/constants.js";

export const RULES_CAPABILITIES = Object.freeze({
  turnPlayRequirement: SPECIFIED_NOT_IMPLEMENTED,
  connectionCompatibility: SPECIFIED_NOT_IMPLEMENTED,
  randomDeal: CAPABILITY_IMPLEMENTED,
  legalMoveChoice: SPECIFIED_NOT_IMPLEMENTED,
  passingAndBlocking: SPECIFIED_NOT_IMPLEMENTED,
  specialDoubleEligibility: SPECIFIED_NOT_IMPLEMENTED,
  mainLineTopology: SPECIFIED_NOT_IMPLEMENTED,
  branchTopology: SPECIFIED_NOT_IMPLEMENTED,
});

export const RULES_READY = false;
export const RULES_SPECIFICATION_COMPLETE = true;
