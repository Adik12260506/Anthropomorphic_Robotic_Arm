/**
 * Gesture Debouncer and Temporal Filter.
 * Prevents UI/servo flickering across rapid camera frames using sliding-window majority voting.
 */

import type { GestureResult, GestureType } from '../types/robot';

export class GestureDebouncer {
  private windowSize: number;
  private history: GestureResult[] = [];
  private currentStableResult: GestureResult;

  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
    this.currentStableResult = {
      gesture: 'NO_HAND',
      confidence: 0,
      fingers: { thumb: false, index: false, middle: false, ring: false, little: false },
      timestamp: Date.now(),
    };
  }

  /**
   * Push a new frame result and return the stabilized gesture result.
   */
  public update(rawResult: GestureResult): GestureResult {
    this.history.push(rawResult);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    // Count occurrences of each gesture in the sliding window
    const counts: Record<string, number> = {};
    let totalConfidence = 0;

    for (const item of this.history) {
      counts[item.gesture] = (counts[item.gesture] || 0) + 1;
      totalConfidence += item.confidence;
    }

    // Find majority gesture
    let majorityGesture: GestureType = this.currentStableResult.gesture;
    let maxCount = 0;

    for (const [gestureStr, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        majorityGesture = gestureStr as GestureType;
      }
    }

    // Require at least 50% agreement to change gesture or retain current
    const threshold = Math.ceil(this.history.length * 0.5);

    if (maxCount >= threshold) {
      const avgConfidence = totalConfidence / this.history.length;
      this.currentStableResult = {
        ...rawResult,
        gesture: majorityGesture,
        confidence: Math.round(avgConfidence * 100) / 100,
      };
    }

    return this.currentStableResult;
  }

  public reset(): void {
    this.history = [];
    this.currentStableResult = {
      gesture: 'NO_HAND',
      confidence: 0,
      fingers: { thumb: false, index: false, middle: false, ring: false, little: false },
      timestamp: Date.now(),
    };
  }
}
