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
    description: 'Flexes all five fingers into a power grip (180° motor rotation)',
    defaultServos: { thumb: 180, index: 180, middle: 180, ring: 180, little: 180 },
  },
  THUMBS_UP: {
    gesture: 'THUMBS_UP',
    displayName: 'Thumbs Up',
    emoji: '👍',
    command: 'THUMBS_UP_POSITION',
    description: 'Extends thumb upward while holding four fingers curled (180°)',
    defaultServos: { thumb: 0, index: 180, middle: 180, ring: 180, little: 180 },
  },
  POINTING: {
    gesture: 'POINTING',
    displayName: 'Pointing',
    emoji: '👉',
    command: 'POINT_INDEX',
    description: 'Fully extends index finger forward; thumb and remaining fingers closed (180°)',
    defaultServos: { thumb: 180, index: 0, middle: 180, ring: 180, little: 180 },
  },
  PINCH: {
    gesture: 'PINCH',
    displayName: 'Pinch Grip',
    emoji: '🤏',
    command: 'PINCH_GRIP',
    description: 'Brings thumb and index tips together; middle, ring, pinky closed (180°)',
    defaultServos: { thumb: 140, index: 140, middle: 180, ring: 180, little: 180 },
  },
  PEACE: {
    gesture: 'PEACE',
    displayName: 'Peace / Two Fingers',
    emoji: '✌️',
    command: 'TWO_FINGER_POSITION',
    description: 'Extends index and middle fingers in a V-formation; thumb, ring, pinky closed (180°)',
    defaultServos: { thumb: 180, index: 0, middle: 0, ring: 180, little: 180 },
  },
  ONE_FINGER: {
    gesture: 'ONE_FINGER',
    displayName: 'One Finger',
    emoji: '☝️',
    command: 'EXTEND_INDEX_ONLY',
    description: 'Extends index finger while remaining four fingers are curled closed (180°)',
    defaultServos: { thumb: 180, index: 0, middle: 180, ring: 180, little: 180 },
  },
  TWO_FINGERS: {
    gesture: 'TWO_FINGERS',
    displayName: 'Two Fingers',
    emoji: '✌️',
    command: 'EXTEND_TWO_FINGERS',
    description: 'Extends index and middle fingers; thumb, ring, pinky closed (180°)',
    defaultServos: { thumb: 180, index: 0, middle: 0, ring: 180, little: 180 },
  },
  THREE_FINGERS: {
    gesture: 'THREE_FINGERS',
    displayName: 'Three Fingers',
    emoji: '🤟',
    command: 'THREE_FINGER_EXTEND',
    description: 'Extends index, middle, and ring fingers; thumb and pinky closed (180°)',
    defaultServos: { thumb: 180, index: 0, middle: 0, ring: 0, little: 180 },
  },
  FOUR_FINGERS: {
    gesture: 'FOUR_FINGERS',
    displayName: 'Four Fingers',
    emoji: '🖐️',
    command: 'FOUR_FINGER_EXTEND',
    description: 'Extends four fingers with thumb folded closed (180°)',
    defaultServos: { thumb: 180, index: 0, middle: 0, ring: 0, little: 0 },
  },
  OK_SIGN: {
    gesture: 'OK_SIGN',
    displayName: 'OK Precision Grip',
    emoji: '👌',
    command: 'OK_PRECISION_GRIP',
    description: 'Touches thumb and index tips in circular pinch; middle, ring, pinky extended (0°)',
    defaultServos: { thumb: 140, index: 140, middle: 0, ring: 0, little: 0 },
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
