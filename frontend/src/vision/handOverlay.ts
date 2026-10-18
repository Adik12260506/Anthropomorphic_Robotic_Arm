/**
 * Futuristic HUD Hand Landmark Canvas Overlay Renderer.
 * Draws glowing cybernetic skeleton, joint nodes, bounding box, and telemetry on the video canvas.
 */

import type { LandmarkPoint } from '../types/robot';

// MediaPipe standard connections between the 21 landmarks
export const HAND_CONNECTIONS: [number, number][] = [
  // Palm Base
  [0, 1], [1, 2], [2, 5], [5, 9], [9, 13], [13, 17], [17, 0],
  // Thumb
  [2, 3], [3, 4],
  // Index
  [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [17, 18], [18, 19], [19, 20],
];

const FINGERTIP_INDICES = new Set([4, 8, 12, 16, 20]);

export interface OverlayOptions {
  gestureName?: string;
  confidence?: number;
  isMirrored?: boolean;
}

export function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[] | undefined,
  width: number,
  height: number,
  options: OverlayOptions = {}
): void {
  ctx.clearRect(0, 0, width, height);

  if (!landmarks || landmarks.length < 21) {
    return;
  }

  const { gestureName, confidence, isMirrored = true } = options;

  ctx.save();

  // If camera is mirrored (selfie/front camera), mirror canvas coords for natural user interaction
  const getX = (normX: number) => (isMirrored ? (1 - normX) * width : normX * width);
  const getY = (normY: number) => normY * height;

  // 1. Calculate bounding box for HUD framing
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of landmarks) {
    const px = getX(pt.x);
    const py = getY(pt.y);
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  // Add padding
  const pad = 24;
  minX = Math.max(8, minX - pad);
  minY = Math.max(8, minY - pad);
  maxX = Math.min(width - 8, maxX + pad);
  maxY = Math.min(height - 8, maxY + pad);

  // 2. Draw Futuristic Cybernetic Bounding Box Corners
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  const cornerLen = 16;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(minX, minY + cornerLen);
  ctx.lineTo(minX, minY);
  ctx.lineTo(minX + cornerLen, minY);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(maxX - cornerLen, minY);
  ctx.lineTo(maxX, minY);
  ctx.lineTo(maxX, minY + cornerLen);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(minX, maxY - cornerLen);
  ctx.lineTo(minX, maxY);
  ctx.lineTo(minX + cornerLen, maxY);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(maxX - cornerLen, maxY);
  ctx.lineTo(maxX, maxY);
  ctx.lineTo(maxX, maxY - cornerLen);
  ctx.stroke();

  // HUD Top Tag
  if (gestureName && gestureName !== 'NO_HAND') {
    ctx.fillStyle = 'rgba(6, 12, 24, 0.75)';
    const tagText = `${gestureName} ${confidence ? `(${Math.round(confidence * 100)}%)` : ''}`;
    ctx.font = 'bold 12px ui-monospace, monospace';
    const textWidth = ctx.measureText(tagText).width;
    ctx.fillRect(minX, Math.max(4, minY - 24), textWidth + 16, 20);

    ctx.fillStyle = '#00f0ff';
    ctx.fillText(tagText, minX + 8, Math.max(18, minY - 10));
  }

  // 3. Draw Skeleton Connections with Cyan Glow
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';

  for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
    const p1 = landmarks[startIdx];
    const p2 = landmarks[endIdx];

    ctx.beginPath();
    ctx.moveTo(getX(p1.x), getY(p1.y));
    ctx.lineTo(getX(p2.x), getY(p2.y));
    ctx.stroke();
  }

  // 4. Draw Joint Nodes
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    const px = getX(pt.x);
    const py = getY(pt.y);
    const isTip = FINGERTIP_INDICES.has(i);

    ctx.beginPath();
    ctx.arc(px, py, isTip ? 6 : 4, 0, 2 * Math.PI);

    if (isTip) {
      ctx.fillStyle = '#10b981'; // Emerald for tips
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
    } else if (i === 0) {
      ctx.fillStyle = '#f59e0b'; // Amber for wrist
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = '#00f0ff'; // Cyan for intermediate joints
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
    }

    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  ctx.restore();
}
