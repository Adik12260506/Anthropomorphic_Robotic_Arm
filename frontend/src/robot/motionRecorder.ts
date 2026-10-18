/**
 * Motion Recorder and Replay Engine for Robotic Arm Routines.
 */

import type { GestureType, MotionFrame, MotionSequence, ServoAngles } from '../types/robot';
import { GESTURE_DEFINITIONS } from './gestureCommands';

export class MotionRecorder {
  private recording: boolean = false;
  private startTime: number = 0;
  private currentFrames: MotionFrame[] = [];
  private playbackTimerId: number | null = null;
  private isCurrentlyPlaying: boolean = false;

  public isRecording(): boolean {
    return this.recording;
  }

  public isPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }

  public startRecording(): void {
    this.recording = true;
    this.startTime = Date.now();
    this.currentFrames = [];
  }

  public recordFrame(gesture: GestureType, servos: ServoAngles): void {
    if (!this.recording) return;

    const offset = Date.now() - this.startTime;

    // Avoid recording identical frames in rapid succession (minimum 100ms interval or change in gesture)
    const lastFrame = this.currentFrames[this.currentFrames.length - 1];
    if (lastFrame && lastFrame.gesture === gesture && offset - lastFrame.timestamp_offset_ms < 150) {
      return;
    }

    this.currentFrames.push({
      timestamp_offset_ms: offset,
      gesture,
      servos: { ...servos },
    });
  }

  public stopRecording(name: string = 'Recorded Routine'): MotionSequence {
    this.recording = false;
    const duration = this.currentFrames.length > 0
      ? this.currentFrames[this.currentFrames.length - 1].timestamp_offset_ms + 200
      : 0;

    return {
      id: `motion-${Date.now()}`,
      name,
      total_duration_ms: duration,
      frames: [...this.currentFrames],
    };
  }

  /**
   * Replay a motion sequence in real-time.
   */
  public replay(
    sequence: MotionSequence,
    onFrame: (frame: MotionFrame, index: number, total: number) => void,
    onComplete: () => void
  ): () => void {
    this.stopPlayback();

    if (!sequence.frames || sequence.frames.length === 0) {
      onComplete();
      return () => {};
    }

    this.isCurrentlyPlaying = true;
    const frames = sequence.frames;
    let currentIndex = 0;
    const playbackStart = Date.now();

    const checkNextFrame = () => {
      if (!this.isCurrentlyPlaying) return;

      const elapsed = Date.now() - playbackStart;

      while (currentIndex < frames.length && elapsed >= frames[currentIndex].timestamp_offset_ms) {
        onFrame(frames[currentIndex], currentIndex, frames.length);
        currentIndex++;
      }

      if (currentIndex < frames.length) {
        this.playbackTimerId = window.setTimeout(checkNextFrame, 20);
      } else {
        this.isCurrentlyPlaying = false;
        onComplete();
      }
    };

    checkNextFrame();

    return () => this.stopPlayback();
  }

  public stopPlayback(): void {
    if (this.playbackTimerId !== null) {
      clearTimeout(this.playbackTimerId);
      this.playbackTimerId = null;
    }
    this.isCurrentlyPlaying = false;
  }

  /**
   * Generates a sample demo routine for presentations/reviews.
   */
  public static getDemoPreset(): MotionSequence {
    const sequenceGestures: GestureType[] = [
      'OPEN_HAND',
      'POINTING',
      'PINCH',
      'PEACE',
      'THUMBS_UP',
      'CLOSED_FIST',
      'OPEN_HAND',
    ];

    let offset = 0;
    const frames: MotionFrame[] = [];

    for (const g of sequenceGestures) {
      const def = GESTURE_DEFINITIONS[g];
      frames.push({
        timestamp_offset_ms: offset,
        gesture: g,
        servos: { ...def.defaultServos },
      });
      offset += 1200; // 1.2s between gestures
    }

    return {
      id: 'demo-preset',
      name: 'Engineering Clinics Demo Routine',
      total_duration_ms: offset,
      frames,
    };
  }
}

export const defaultMotionRecorder = new MotionRecorder();
