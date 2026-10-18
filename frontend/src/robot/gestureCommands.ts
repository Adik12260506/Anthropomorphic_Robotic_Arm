/**
 * Central Mapping: Hand Gestures -> Anthropomorphic Robotic Arm Commands.
 * 
 * NOTE FOR REVIEW 2 EVALUATION & HARDWARE TEAM:
 * The servo angles specified below are DEMO / SIMULATION VALUES (0° = open, 90°–180° = curled).
 * They represent simulated kinematic targets for TowerPro MG90S metal-gear servos
 * controlled by a PCA9685 16-channel 12-bit PWM driver, until the hardware team completes
 * final physical mechanical linkage calibration on the 3D-printed anthropomorphic hand.
 */

import type { GestureType, RobotCommand, ServoAngles } from '../types/robot';

export interface GestureDefinition {
  gesture: GestureType;
  displayName: string;
  emoji: string;
  command: string;
  description: string;
  defaultServos: ServoAngles;
}

export const GESTURE_DEFINITIONS: Record<GestureType, GestureDefinition> = {
  OPEN_HAND: {
    gesture: 'OPEN_HAND',
    displayName: 'Open Hand',
    emoji: '✋',
    command: 'OPEN_ALL_FINGERS',
    description: 'Fully extends all five fingers (ready to release / idle state)',
    defaultServos: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 },
  },
  CLOSED_FIST: {
    gesture: 'CLOSED_FIST',
    displayName: 'Closed Fist',
    emoji: '✊',
    command: 'CLOSE_ALL_FINGERS',
    description: 'Flexes all five fingers into a power grip',
    defaultServos: { thumb: 90, index: 90, middle: 90, ring: 90, little: 90 },
  },
  THUMBS_UP: {
    gesture: 'THUMBS_UP',
    displayName: 'Thumbs Up',
    emoji: '👍',
    command: 'THUMBS_UP_POSITION',
    description: 'Extends thumb upward while holding four fingers curled',
    defaultServos: { thumb: 0, index: 90, middle: 90, ring: 90, little: 90 },
  },
  POINTING: {
    gesture: 'POINTING',
    displayName: 'Pointing',
    emoji: '👉',
    command: 'POINT_INDEX',
    description: 'Fully extends index finger forward for precise pointing/selection',
    defaultServos: { thumb: 80, index: 0, middle: 90, ring: 90, little: 90 },
  },
  PINCH: {
    gesture: 'PINCH',
    displayName: 'Pinch Grip',
    emoji: '🤏',
    command: 'PINCH_GRIP',
    description: 'Brings thumb and index tips together for delicate item pick-up',
    defaultServos: { thumb: 65, index: 70, middle: 20, ring: 20, little: 20 },
  },
  PEACE: {
    gesture: 'PEACE',
    displayName: 'Peace / Two Fingers',
    emoji: '✌️',
    command: 'TWO_FINGER_POSITION',
    description: 'Extends index and middle fingers in a V-formation',
    defaultServos: { thumb: 90, index: 0, middle: 0, ring: 90, little: 90 },
  },
  ONE_FINGER: {
    gesture: 'ONE_FINGER',
    displayName: 'One Finger',
    emoji: '☝️',
    command: 'EXTEND_INDEX_ONLY',
    description: 'Extends index finger while remaining four fingers are curled',
    defaultServos: { thumb: 85, index: 0, middle: 85, ring: 85, little: 85 },
  },
  TWO_FINGERS: {
    gesture: 'TWO_FINGERS',
    displayName: 'Two Fingers',
    emoji: '✌️',
    command: 'EXTEND_TWO_FINGERS',
    description: 'Extends index and middle fingers',
    defaultServos: { thumb: 90, index: 0, middle: 0, ring: 90, little: 90 },
  },
  THREE_FINGERS: {
    gesture: 'THREE_FINGERS',
    displayName: 'Three Fingers',
    emoji: '🤟',
    command: 'THREE_FINGER_EXTEND',
    description: 'Extends index, middle, and ring fingers',
    defaultServos: { thumb: 85, index: 0, middle: 0, ring: 0, little: 85 },
  },
  FOUR_FINGERS: {
    gesture: 'FOUR_FINGERS',
    displayName: 'Four Fingers',
    emoji: '🖐️',
    command: 'FOUR_FINGER_EXTEND',
    description: 'Extends four fingers with thumb folded inwards',
    defaultServos: { thumb: 90, index: 0, middle: 0, ring: 0, little: 0 },
  },
  OK_SIGN: {
    gesture: 'OK_SIGN',
    displayName: 'OK Precision Grip',
    emoji: '👌',
    command: 'OK_PRECISION_GRIP',
    description: 'Touches thumb and index tips in circular pinch; middle, ring, pinky extended',
    defaultServos: { thumb: 55, index: 60, middle: 0, ring: 0, little: 0 },
  },
  UNKNOWN: {
    gesture: 'UNKNOWN',
    displayName: 'Analyzing...',
    emoji: '🔄',
    command: 'HOLD_POSITION',
    description: 'Intermediate or transitioning hand state; holding current servo position',
    defaultServos: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 },
  },
  NO_HAND: {
    gesture: 'NO_HAND',
    displayName: 'No Hand Detected',
    emoji: '❓',
    command: 'STANDBY_REST',
    description: 'No hand currently in camera frame; standing by in neutral pose',
    defaultServos: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 },
  },
};

/**
 * Converts a recognized gesture into a structured RobotCommand.
 */
export function mapGestureToRobotCommand(
  gesture: GestureType,
  clientId: string = 'Phone-A-Vision'
): RobotCommand {
  const definition = GESTURE_DEFINITIONS[gesture] || GESTURE_DEFINITIONS.UNKNOWN;
  return {
    gesture: definition.gesture,
    command: definition.command,
    servos: { ...definition.defaultServos },
    timestamp: Date.now(),
    client_id: clientId,
  };
}

/**
 * Validates whether a detected gesture is safe and actionable for the robot arm.
 * Prevents transmitting jerky or unverified motions to servos during transitions or low confidence.
 */
export function isValidRobotGesture(gesture: GestureType, confidence: number): boolean {
  if (gesture === 'NO_HAND' || gesture === 'UNKNOWN') {
    return false;
  }
  return confidence >= 0.65;
}
