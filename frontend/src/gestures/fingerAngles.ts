/**
 * 3D Geometric Vector and Joint Angle Calculations for MediaPipe 21 Hand Landmarks.
 */

import type { FingerStates, LandmarkPoint } from '../types/robot';

// MediaPipe 21 Landmark Indices
export const HAND_LANDMARKS = {
  WRIST: 0,
  // Thumb
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  // Index
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  // Middle
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  // Ring
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  // Pinky (Little)
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

/**
 * 3D Euclidean Distance between two landmarks.
 */
export function euclideanDistance(p1: LandmarkPoint, p2: LandmarkPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate the angle (in degrees) at vertex B formed by segments AB and BC.
 */
export function jointAngle(a: LandmarkPoint, b: LandmarkPoint, c: LandmarkPoint): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (c.z || 0) };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 === 0 || mag2 === 0) return 180;
  const cosine = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

/**
 * Detect individual finger extension states (extended vs curled)
 * invariant to hand scale and distance from camera.
 */
export function analyzeFingerStates(landmarks: LandmarkPoint[]): {
  fingers: FingerStates;
  palmScale: number;
  pinchDistanceRatio: number;
  isThumbUpVector: boolean;
} {
  const wrist = landmarks[HAND_LANDMARKS.WRIST];
  const middleMcp = landmarks[HAND_LANDMARKS.MIDDLE_MCP];

  // Palm scale reference: wrist to middle MCP
  const palmScale = Math.max(0.001, euclideanDistance(wrist, middleMcp));

  // Helper to determine if a non-thumb finger is extended
  const isExtended = (mcpIdx: number, pipIdx: number, tipIdx: number): boolean => {
    const mcp = landmarks[mcpIdx];
    const pip = landmarks[pipIdx];
    const tip = landmarks[tipIdx];

    const distTipWrist = euclideanDistance(tip, wrist);
    const distPipWrist = euclideanDistance(pip, wrist);
    const pipAngle = jointAngle(mcp, pip, tip);

    // Finger is considered extended if the tip is farther from wrist than PIP
    // and the joint angle at PIP is sufficiently open (> 130 degrees)
    return distTipWrist > distPipWrist && pipAngle > 130;
  };

  const indexExtended = isExtended(
    HAND_LANDMARKS.INDEX_MCP,
    HAND_LANDMARKS.INDEX_PIP,
    HAND_LANDMARKS.INDEX_TIP
  );

  const middleExtended = isExtended(
    HAND_LANDMARKS.MIDDLE_MCP,
    HAND_LANDMARKS.MIDDLE_PIP,
    HAND_LANDMARKS.MIDDLE_TIP
  );

  const ringExtended = isExtended(
    HAND_LANDMARKS.RING_MCP,
    HAND_LANDMARKS.RING_PIP,
    HAND_LANDMARKS.RING_TIP
  );

  const littleExtended = isExtended(
    HAND_LANDMARKS.PINKY_MCP,
    HAND_LANDMARKS.PINKY_PIP,
    HAND_LANDMARKS.PINKY_TIP
  );

  // Thumb analysis:
  const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];
  const thumbIp = landmarks[HAND_LANDMARKS.THUMB_IP];
  const thumbMcp = landmarks[HAND_LANDMARKS.THUMB_MCP];
  const pinkyMcp = landmarks[HAND_LANDMARKS.PINKY_MCP];

  const thumbToPinkyDist = euclideanDistance(thumbTip, pinkyMcp);
  const thumbAngle = jointAngle(thumbMcp, thumbIp, thumbTip);

  // Thumb is extended when tip is away from palm center and joint is relatively straight
  const thumbExtended = thumbToPinkyDist > 0.85 * palmScale && thumbAngle > 125;

  // Pinch distance: Euclidean distance between thumb tip and index tip normalized by palm scale
  const indexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
  const pinchDistance = euclideanDistance(thumbTip, indexTip);
  const pinchDistanceRatio = pinchDistance / palmScale;

  // Vector orientation for Thumbs Up:
  // Thumb points upward (smaller y in normalized screen coords) while other fingers are curled
  const isThumbUpVector = thumbTip.y < thumbMcp.y && thumbMcp.y < wrist.y && Math.abs(thumbTip.x - thumbMcp.x) < 0.15;

  return {
    fingers: {
      thumb: thumbExtended,
      index: indexExtended,
      middle: middleExtended,
      ring: ringExtended,
      little: littleExtended,
    },
    palmScale,
    pinchDistanceRatio,
    isThumbUpVector,
  };
}
