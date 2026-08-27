import {
  CAPABILITY_IMPLEMENTED,
  SPECIFIED_NOT_IMPLEMENTED,
} from "../../utils/constants.js";

export const TURN_CAPABILITIES = Object.freeze({
  initialPlayer: CAPABILITY_IMPLEMENTED,
  twoVsTwoOrder: CAPABILITY_IMPLEMENTED,
  turnTransition: SPECIFIED_NOT_IMPLEMENTED,
  passing: SPECIFIED_NOT_IMPLEMENTED,
  fourPassBlock: SPECIFIED_NOT_IMPLEMENTED,
});

export const TURN_MANAGER_READY = false;
