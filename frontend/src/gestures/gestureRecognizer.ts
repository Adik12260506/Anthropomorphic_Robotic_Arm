/**
 * Dedicated Gesture Recognizer Engine.
 * Analyzes geometric landmark data and finger flexion to classify 10+ distinct hand gestures.
 */

import type { GestureResult, GestureType, LandmarkPoint } from '../types/robot';
import { analyzeFingerStates } from './fingerAngles';

export class GestureRecognizer {
  /**
   * Classify hand gesture from 21 MediaPipe landmarks.
   */
  public recognize(landmarks: LandmarkPoint[] | undefined, handType: 'Left' | 'Right' = 'Right'): GestureResult {
    const timestamp = Date.now();

    if (!landmarks || landmarks.length < 21) {
      return {
        gesture: 'NO_HAND',
        confidence: 0.0,
        fingers: { thumb: false, index: false, middle: false, ring: false, little: false },
        timestamp,
      };
    }

    const { fingers, pinchDistanceRatio, isThumbUpVector } = analyzeFingerStates(landmarks);
    const { thumb, index, middle, ring, little } = fingers;

    const extendedCount = (index ? 1 : 0) + (middle ? 1 : 0) + (ring ? 1 : 0) + (little ? 1 : 0);

    let gesture: GestureType = 'UNKNOWN';
    let confidence = 0.85;

    // 1. PINCH or OK_SIGN check: Thumb Tip & Index Tip in close proximity
    if (pinchDistanceRatio < 0.32) {
      if (middle && ring && little) {
        gesture = 'OK_SIGN';
        confidence = 0.95;
      } else {
        gesture = 'PINCH';
        confidence = Math.min(0.98, 0.70 + (0.32 - pinchDistanceRatio) * 1.5);
      }
    }
    // 2. OPEN HAND: All 5 fingers extended, or 4 fingers extended with thumb relaxed
    else if (extendedCount === 4 && thumb) {
      gesture = 'OPEN_HAND';
      confidence = 0.96;
    } else if (extendedCount === 4 && !thumb) {
      gesture = 'FOUR_FINGERS';
      confidence = 0.92;
    }
    // 3. CLOSED FIST: None of the 4 main fingers extended, thumb curled
    else if (extendedCount === 0 && !thumb) {
      gesture = 'CLOSED_FIST';
      confidence = 0.95;
    }
    // 4. THUMBS UP: Thumb extended upwards, all 4 main fingers curled
    else if (thumb && extendedCount === 0 && isThumbUpVector) {
      gesture = 'THUMBS_UP';
      confidence = 0.94;
    }
    // 5. POINTING / ONE FINGER: Index extended, others curled
    else if (index && !middle && !ring && !little) {
      gesture = 'POINTING';
      confidence = 0.94;
    }
    // 6. PEACE / TWO FINGERS: Index & Middle extended, Ring & Little curled
    else if (index && middle && !ring && !little) {
      gesture = 'PEACE';
      confidence = 0.93;
    }
    // 7. THREE FINGERS: Index, Middle, Ring extended
    else if (index && middle && ring && !little) {
      gesture = 'THREE_FINGERS';
      confidence = 0.91;
    }
    // Fallback based on single finger counts
    else if (extendedCount === 1 && index) {
      gesture = 'ONE_FINGER';
      confidence = 0.88;
    } else if (extendedCount === 2 && index && middle) {
      gesture = 'TWO_FINGERS';
      confidence = 0.89;
    } else {
      gesture = 'UNKNOWN';
      confidence = 0.60;
    }

    return {
      gesture,
      confidence: Math.round(confidence * 100) / 100,
      fingers,
      landmarks,
      handType,
      timestamp,
    };
  }
}

export const defaultGestureRecognizer = new GestureRecognizer();
