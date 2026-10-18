/**
 * Type definitions for Robotic Arm Control, Gestures, and Servo kinematics.
 */

export interface ServoAngles {
  thumb: number;   // 0 (fully extended/open) to 180 (fully flexed/closed)
  index: number;
  middle: number;
  ring: number;
  little: number;
}

export interface FingerStates {
  thumb: boolean;   // true if extended, false if curled
  index: boolean;
  middle: boolean;
  ring: boolean;
  little: boolean;
}

export type GestureType =
  | 'OPEN_HAND'
  | 'CLOSED_FIST'
  | 'THUMBS_UP'
  | 'POINTING'
  | 'PINCH'
  | 'PEACE'
  | 'ONE_FINGER'
  | 'TWO_FINGERS'
  | 'THREE_FINGERS'
  | 'FOUR_FINGERS'
  | 'OK_SIGN'
  | 'UNKNOWN'
  | 'NO_HAND';

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface GestureResult {
  gesture: GestureType;
  confidence: number;
  fingers: FingerStates;
  landmarks?: LandmarkPoint[];
  handType?: 'Left' | 'Right';
  timestamp: number;
}

export interface RobotCommand {
  gesture: string;
  command: string;
  servos: ServoAngles;
  timestamp: number;
  client_id?: string;
}

export interface RobotState {
  mode: 'SIMULATION' | 'ESP32_CONNECTED';
  servos: ServoAngles;
  last_command: string;
  last_gesture: string;
  is_connected: boolean;
  hardware_target: string;
  updated_at: number;
}

export interface MotionFrame {
  timestamp_offset_ms: number;
  gesture: GestureType;
  servos: ServoAngles;
}

export interface MotionSequence {
  id: string;
  name: string;
  total_duration_ms: number;
  frames: MotionFrame[];
}

export interface CommandHistoryItem {
  id: string;
  timeString: string;
  timestamp: number;
  gesture: string;
  command: string;
  servos: ServoAngles;
}
