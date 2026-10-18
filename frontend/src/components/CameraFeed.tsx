import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Mic, MicOff, RefreshCw, AlertTriangle, Sparkles, ShieldAlert, PlayCircle } from 'lucide-react';
import type { LandmarkPoint } from '../types/robot';
import { mediaPipeVisionManager } from '../vision/mediaPipeLoader';
import { drawHandOverlay } from '../vision/handOverlay';

interface CameraFeedProps {
  onFrameLandmarks?: (landmarks: LandmarkPoint[] | undefined) => void;
  onFpsUpdate?: (fps: number) => void;
  activeGestureName?: string;
  activeConfidence?: number;
  isMirrored?: boolean;
  onStreamReady?: (stream: MediaStream) => void;
}

interface CameraErrorState {
  type: 'insecure_context' | 'permission_denied' | 'not_found' | 'in_use' | 'generic';
  title: string;
  message: string;
  detail?: string;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  onFrameLandmarks,
  onFpsUpdate,
  activeGestureName = 'NO_HAND',
  activeConfidence = 0,
  isMirrored = true,
  onStreamReady,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [micActive, setMicActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<CameraErrorState | null>(null);
  const [isVisionLoading, setIsVisionLoading] = useState<boolean>(true);
  const [visionReady, setVisionReady] = useState<boolean>(false);
  const [useSimulatedFeed, setUseSimulatedFeed] = useState<boolean>(false);

  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const simFrameIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const fpsFrameCountRef = useRef<number>(0);
  const fpsLastTimeRef = useRef<number>(performance.now());

  // Initialize MediaPipe Tasks Vision HandLandmarker
  useEffect(() => {
    let isMounted = true;
    setIsVisionLoading(true);

    mediaPipeVisionManager
      .getHandLandmarker()
      .then(() => {
        if (isMounted) {
          setVisionReady(true);
          setIsVisionLoading(false);
        }
      })
      .catch((err) => {
        console.error('MediaPipe initialization error:', err);
        if (isMounted) {
          setIsVisionLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize Camera Stream with Comprehensive Security and Error Checking
  const initCamera = useCallback(async () => {
    setCameraError(null);
    setUseSimulatedFeed(false);

    // 1. Check for Secure Context (HTTPS or localhost / Capacitor requirement in modern browsers)
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '::1' ||
        window.location.protocol === 'capacitor:');
    const isSecure = typeof window !== 'undefined' && (window.isSecureContext || isLocal);

    if (!isSecure && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
      setCameraError({
        type: 'insecure_context',
        title: 'CAMERA ACCESS RESTRICTED',
        message: 'Camera requires HTTPS or local secure context.',
        detail:
          'For web testing use localhost or HTTPS tunnel. In Android APK, camera access is granted via native Android permissions.',
      });
      setCameraActive(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError({
        type: 'generic',
        title: 'CAMERA API UNSUPPORTED',
        message: 'MediaDevices getUserMedia API is unavailable in this environment.',
        detail: 'Please update your WebView/browser or ensure camera permissions are permitted.',
      });
      setCameraActive(false);
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: micActive,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      if (onStreamReady) {
        onStreamReady(stream);
      }
      setCameraActive(true);
      setCameraError(null);
    } catch (err: any) {
      console.error('Camera acquisition error:', err);
      let errorState: CameraErrorState = {
        type: 'generic',
        title: 'CAMERA NOTICE',
        message: 'Could not access camera.',
        detail: err?.message || 'Unknown error occurred while accessing video stream.',
      };

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorState = {
          type: 'permission_denied',
          title: 'CAMERA PERMISSION DENIED',
          message: 'Camera access permission was denied.',
          detail:
            'Please allow camera permission. On Android devices: open Android Settings -> Apps -> Robotic Arm Vision -> Permissions -> enable Camera, then tap Retry Camera.',
        };
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorState = {
          type: 'not_found',
          title: 'NO CAMERA DETECTED',
          message: 'No video capture hardware was found on this system.',
          detail: 'Please connect a USB webcam or ensure your device camera is functional.',
        };
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorState = {
          type: 'in_use',
          title: 'CAMERA IN USE / BUSY',
          message: 'Camera is currently locked by another application or process.',
          detail: 'Close other camera apps, video calling software, or browser tabs and tap Retry Camera.',
        };
      } else if (err.name === 'SecurityError' || !isSecure) {
        errorState = {
          type: 'insecure_context',
          title: 'CAMERA ACCESS RESTRICTED',
          message: 'Camera requires HTTPS when accessed over network.',
          detail: 'Run via HTTPS tunnel or use the Android APK directly.',
        };
      }

      setCameraError(errorState);
      setCameraActive(false);
    }
  }, [facingMode, micActive, onStreamReady]);

  // Initial trigger of camera
  useEffect(() => {
    initCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (simFrameIdRef.current) {
        cancelAnimationFrame(simFrameIdRef.current);
      }
    };
  }, [initCamera]);

  // Main Landmark Tracking & Canvas Render Loop (Live Camera)
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !visionReady || useSimulatedFeed) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const processLoop = async () => {
      if (!isRunning) return;

      if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        // Synchronize canvas dimensions with actual video resolution
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        // FPS calculation
        fpsFrameCountRef.current++;
        const now = performance.now();
        if (now - fpsLastTimeRef.current >= 1000) {
          const currentFps = Math.round((fpsFrameCountRef.current * 1000) / (now - fpsLastTimeRef.current));
          if (onFpsUpdate) onFpsUpdate(currentFps);
          fpsFrameCountRef.current = 0;
          fpsLastTimeRef.current = now;
        }

        try {
          const landmarker = await mediaPipeVisionManager.getHandLandmarker();
          const results = landmarker.detectForVideo(video, performance.now());

          let detectedLandmarks: LandmarkPoint[] | undefined = undefined;

          if (results.landmarks && results.landmarks.length > 0) {
            detectedLandmarks = results.landmarks[0].map((pt) => ({
              x: pt.x,
              y: pt.y,
              z: pt.z,
            }));
          }

          // Draw futuristic skeleton and joints on canvas
          drawHandOverlay(ctx, detectedLandmarks, canvas.width, canvas.height, {
            gestureName: activeGestureName,
            confidence: activeConfidence,
            isMirrored: isMirrored && facingMode === 'user',
          });

          if (onFrameLandmarks) {
            onFrameLandmarks(detectedLandmarks);
          }
        } catch {
          // Frame skip if landmarker is busy
        }
      }

      animFrameIdRef.current = requestAnimationFrame(processLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(processLoop);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [visionReady, activeGestureName, activeConfidence, isMirrored, facingMode, useSimulatedFeed, onFrameLandmarks, onFpsUpdate]);

  // Fallback Simulation Loop for Restricted / Demo environments
  useEffect(() => {
    if (!useSimulatedFeed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 640;
    canvas.height = 480;

    let isRunning = true;
    let frame = 0;

    const simLoop = () => {
      if (!isRunning) return;
      frame++;

      // Clear and draw animated cybernetic grid
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Generate synthetic 21 hand landmarks for demonstration
      const t = frame * 0.03;
      const baseX = 0.5 + Math.sin(t) * 0.05;
      const baseY = 0.55 + Math.cos(t * 0.7) * 0.04;

      const landmarks: LandmarkPoint[] = [
        { x: baseX, y: baseY, z: 0 }, // 0: wrist
        // Thumb
        { x: baseX - 0.06, y: baseY - 0.04, z: -0.01 },
        { x: baseX - 0.10, y: baseY - 0.08, z: -0.02 },
        { x: baseX - 0.13, y: baseY - 0.13, z: -0.03 },
        { x: baseX - 0.15, y: baseY - 0.18, z: -0.04 },
        // Index
        { x: baseX - 0.04, y: baseY - 0.12, z: -0.01 },
        { x: baseX - 0.05, y: baseY - 0.18, z: -0.02 },
        { x: baseX - 0.06, y: baseY - 0.23, z: -0.03 },
        { x: baseX - 0.06, y: baseY - 0.28, z: -0.04 },
        // Middle
        { x: baseX, y: baseY - 0.13, z: -0.01 },
        { x: baseX, y: baseY - 0.20, z: -0.02 },
        { x: baseX, y: baseY - 0.26, z: -0.03 },
        { x: baseX, y: baseY - 0.31, z: -0.04 },
        // Ring
        { x: baseX + 0.04, y: baseY - 0.12, z: -0.01 },
        { x: baseX + 0.05, y: baseY - 0.18, z: -0.02 },
        { x: baseX + 0.06, y: baseY - 0.23, z: -0.03 },
        { x: baseX + 0.06, y: baseY - 0.28, z: -0.04 },
        // Pinky
        { x: baseX + 0.08, y: baseY - 0.09, z: -0.01 },
        { x: baseX + 0.10, y: baseY - 0.14, z: -0.02 },
        { x: baseX + 0.12, y: baseY - 0.18, z: -0.03 },
        { x: baseX + 0.13, y: baseY - 0.22, z: -0.04 },
      ];

      drawHandOverlay(ctx, landmarks, canvas.width, canvas.height, {
        gestureName: 'OPEN_HAND (SIMULATED)',
        confidence: 0.99,
        isMirrored: false,
      });

      if (onFrameLandmarks) {
        onFrameLandmarks(landmarks);
      }
      if (onFpsUpdate) {
        onFpsUpdate(30);
      }

      simFrameIdRef.current = requestAnimationFrame(simLoop);
    };

    simFrameIdRef.current = requestAnimationFrame(simLoop);

    return () => {
      isRunning = false;
      if (simFrameIdRef.current) {
        cancelAnimationFrame(simFrameIdRef.current);
      }
    };
  }, [useSimulatedFeed, onFrameLandmarks, onFpsUpdate]);

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraActive(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicActive(audioTrack.enabled);
      }
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden glass-panel border border-slate-700/80 bg-slate-950 flex flex-col">
      {/* Video & Canvas Container */}
      <div className="relative aspect-video w-full flex items-center justify-center bg-black overflow-hidden">
        {/* Live Video Element */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover ${
            isMirrored && facingMode === 'user' ? 'scale-x-[-1]' : ''
          } ${!cameraActive || useSimulatedFeed ? 'hidden' : 'block'}`}
        />

        {/* Canvas Overlay for Hand Skeleton & Bounding Box */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />

        {/* Cybernetic HUD Scanline */}
        <div className="hud-scanline" />

        {/* Loading Spinner for MediaPipe Tasks Vision */}
        {isVisionLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-20 backdrop-blur-sm">
            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <span className="mt-3 text-xs font-mono text-cyan-300">Loading MediaPipe Hand Vision...</span>
          </div>
        )}

        {/* Informative Error & HTTPS Requirement Overlay */}
        {cameraError && !useSimulatedFeed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-5 text-center z-20 overflow-y-auto">
            {cameraError.type === 'insecure_context' ? (
              <ShieldAlert className="w-10 h-10 text-amber-400 mb-2 shrink-0 animate-pulse" />
            ) : (
              <AlertTriangle className="w-10 h-10 text-rose-400 mb-2 shrink-0" />
            )}

            <h4 className="text-sm font-mono font-bold text-white tracking-wide uppercase">
              {cameraError.title}
            </h4>

            <p className="text-xs font-semibold text-amber-300 mt-2 max-w-sm">
              {cameraError.message}
            </p>

            {cameraError.detail && (
              <p className="text-[11px] font-mono text-slate-400 mt-2 max-w-md bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left">
                {cameraError.detail}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <button
                onClick={() => initCamera()}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-semibold transition-colors shadow-lg shadow-cyan-600/20"
              >
                Retry Camera
              </button>

              <button
                onClick={() => setUseSimulatedFeed(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-mono border border-emerald-500/40 transition-colors"
                title="Run landmark tracking on simulated camera hand for Review 2 demo"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Test Simulated Hand
              </button>
            </div>
          </div>
        )}

        {/* Camera Off State Overlay */}
        {!cameraActive && !cameraError && !useSimulatedFeed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-5 text-center z-20">
            <CameraOff className="w-10 h-10 text-slate-500 mb-2 shrink-0 animate-pulse" />
            <h4 className="text-sm font-mono font-bold text-slate-200 tracking-wide uppercase">
              CAMERA IS TURNED OFF
            </h4>
            <p className="text-xs font-mono text-slate-400 mt-1 max-w-sm">
              Live hand landmark vision tracking is paused while camera is inactive.
            </p>
            <button
              onClick={() => {
                setCameraActive(true);
                initCamera();
              }}
              className="mt-3.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-semibold transition-colors shadow-lg shadow-cyan-600/20"
            >
              Turn On Camera
            </button>
          </div>
        )}

        {/* HUD Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-slate-700/60 px-2.5 py-1 rounded-lg">
            <div
              className={`w-2 h-2 rounded-full ${
                useSimulatedFeed
                  ? 'bg-amber-400 animate-ping'
                  : cameraActive
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px] font-mono text-slate-200">
              {useSimulatedFeed ? 'SIMULATED CAMERA' : 'LOCAL CAMERA'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur border border-slate-700/60 px-2 py-1 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-mono text-cyan-300">MEDIAPIPE 21</span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Camera Toggle */}
          <button
            onClick={toggleCamera}
            disabled={useSimulatedFeed}
            className={`p-2 rounded-xl border transition-colors ${
              cameraActive && !useSimulatedFeed
                ? 'bg-slate-800 text-cyan-400 border-slate-700 hover:bg-slate-700'
                : 'bg-red-500/20 text-red-400 border-red-500/40'
            }`}
            title={cameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {cameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
          </button>

          {/* Microphone Toggle */}
          <button
            onClick={toggleMic}
            disabled={useSimulatedFeed}
            className={`p-2 rounded-xl border transition-colors ${
              micActive
                ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-800/60 text-slate-400 border-slate-700'
            }`}
            title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Switch Camera (Front / Rear) */}
          <button
            onClick={switchCamera}
            disabled={useSimulatedFeed}
            className="p-2 rounded-xl border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-40"
            title="Switch Camera (Front/Rear)"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {useSimulatedFeed && (
            <button
              onClick={() => {
                setUseSimulatedFeed(false);
                initCamera();
              }}
              className="text-[10px] font-mono text-cyan-400 hover:underline"
            >
              Switch to Real Cam
            </button>
          )}
          <span className="text-[11px] font-mono text-slate-400">
            {facingMode === 'user' ? 'Front Cam' : 'Rear Cam'}
          </span>
        </div>
      </div>
    </div>
  );
};
