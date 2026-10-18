/**
 * MediaPipe Tasks Vision - HandLandmarker Loader and Lifecycle Manager.
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

class MediaPipeVisionManager {
  private handLandmarker: HandLandmarker | null = null;
  private initPromise: Promise<HandLandmarker> | null = null;

  /**
   * Initializes and returns the HandLandmarker instance.
   * Uses GPU delegate with automatic CPU fallback.
   */
  public async getHandLandmarker(): Promise<HandLandmarker> {
    if (this.handLandmarker) {
      return this.handLandmarker;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log('Loading MediaPipe Vision WASM files...');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        console.log('Creating HandLandmarker with GPU delegate...');
        try {
          this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch (gpuError) {
          console.warn('GPU delegate failed, falling back to CPU delegate:', gpuError);
          this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }

        console.log('MediaPipe HandLandmarker successfully loaded!');
        return this.handLandmarker;
      } catch (error) {
        console.error('Failed to initialize MediaPipe HandLandmarker:', error);
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  public isReady(): boolean {
    return this.handLandmarker !== null;
  }
}

export const mediaPipeVisionManager = new MediaPipeVisionManager();
