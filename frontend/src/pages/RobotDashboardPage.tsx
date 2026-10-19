import React, { useState } from 'react';
import { CameraFeed } from '../components/CameraFeed';
import { GestureCard } from '../components/GestureCard';
import { RobotCommandViewer } from '../components/RobotCommandViewer';
import { RobotSimulator } from '../components/RobotSimulator';
import { MotionHistory } from '../components/MotionHistory';
import { ConnectionStatusHUD } from '../components/ConnectionStatusHUD';
import { ApiService } from '../services/api';
import { defaultGestureRecognizer } from '../gestures/gestureRecognizer';
import { GestureDebouncer } from '../gestures/gestureDebouncer';
import { mapGestureToRobotCommand, isValidRobotGesture } from '../robot/gestureCommands';
import type {
  GestureResult,
  GestureType,
  LandmarkPoint,
  RobotCommand,
  ServoAngles,
  CommandHistoryItem,
  MotionFrame,
} from '../types/robot';
import { ArrowLeft, Sparkles } from 'lucide-react';

interface RobotDashboardPageProps {
  onBackToHome: () => void;
  apiConnected: boolean;
}

export const RobotDashboardPage: React.FC<RobotDashboardPageProps> = ({
  onBackToHome,
  apiConnected,
}) => {
  const [debouncer] = useState(() => new GestureDebouncer(4));
  const [gestureResult, setGestureResult] = useState<GestureResult>({
    gesture: 'NO_HAND',
    confidence: 0,
    fingers: { thumb: false, index: false, middle: false, ring: false, little: false },
    timestamp: Date.now(),
  });

  const [activeCommand, setActiveCommand] = useState<RobotCommand>(() =>
    mapGestureToRobotCommand('OPEN_HAND', 'Single-Device-Demo')
  );

  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);

  // Frame processing from CameraFeed with safety validation
  const handleFrameLandmarks = (landmarks: LandmarkPoint[] | undefined) => {
    const raw = defaultGestureRecognizer.recognize(landmarks);
    const stable = debouncer.update(raw);

    if (stable.gesture !== gestureResult.gesture) {
      setGestureResult(stable);

      // Safety check: Only generate and transmit robot commands if gesture is recognized and confident
      if (isValidRobotGesture(stable.gesture, stable.confidence)) {
        const cmd = mapGestureToRobotCommand(stable.gesture, 'Vision-Control');
        setActiveCommand(cmd);

        // Record history item
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0];
        setHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            timeString,
            timestamp: Date.now(),
            gesture: cmd.gesture,
            command: cmd.command,
            servos: cmd.servos,
          },
          ...prev.slice(0, 49),
        ]);

        // Send command to FastAPI backend
        const t0 = performance.now();
        ApiService.sendRobotCommand(cmd)
          .then(() => {
            const dt = Math.round(performance.now() - t0);
            setLatencyMs(dt);
          })
          .catch(() => {
            setLatencyMs(null);
          });
      }
    }
  };

  const handleSimulateGesture = (gesture: GestureType) => {
    const cmd = mapGestureToRobotCommand(gesture, 'Simulated-Test');
    setActiveCommand(cmd);
    setGestureResult({
      gesture,
      confidence: 0.98,
      fingers: {
        thumb: cmd.servos.thumb < 90,
        index: cmd.servos.index < 90,
        middle: cmd.servos.middle < 90,
        ring: cmd.servos.ring < 90,
        little: cmd.servos.little < 90,
      },
      timestamp: Date.now(),
    });

    const now = new Date();
    setHistory((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        timeString: now.toTimeString().split(' ')[0],
        timestamp: Date.now(),
        gesture: cmd.gesture,
        command: cmd.command,
        servos: cmd.servos,
      },
      ...prev.slice(0, 49),
    ]);

    ApiService.sendRobotCommand(cmd).catch(() => {});
  };

  const handleManualServoAdjust = (servos: ServoAngles) => {
    setActiveCommand((prev) => ({
      ...prev,
      command: 'MANUAL_OVERRIDE',
      gesture: 'MANUAL',
      servos,
    }));
    ApiService.manualServoAdjust(servos).catch(() => {});
  };

  const handleReplayFrame = (frame: MotionFrame) => {
    const cmd = mapGestureToRobotCommand(frame.gesture, 'Routine-Replay');
    cmd.servos = frame.servos;
    setActiveCommand(cmd);
    setGestureResult({
      gesture: frame.gesture,
      confidence: 1.0,
      fingers: {
        thumb: frame.servos.thumb < 90,
        index: frame.servos.index < 90,
        middle: frame.servos.middle < 90,
        ring: frame.servos.ring < 90,
        little: frame.servos.little < 90,
      },
      timestamp: Date.now(),
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 p-3 sm:p-5 max-w-7xl mx-auto w-full">
      {/* Navigation Header */}
      <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white tracking-wide">
                STANDALONE DEMO MODE
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700">
                Single Phone / Laptop Camera
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              MediaPipe Hand Landmark Tracking & Robotic Arm Simulator
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Active Pipeline
          </span>
        </div>
      </div>

      {/* Telemetry Bar */}
      <ConnectionStatusHUD
        fps={fps}
        isHandDetected={gestureResult.gesture !== 'NO_HAND'}
        gestureName={gestureResult.gesture}
        confidence={gestureResult.confidence}
        webrtcStatus="disconnected"
        apiConnected={apiConnected}
        latencyMs={latencyMs}
      />

      {/* Main Vision + Robot Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Camera Video Feed & Gesture Detection */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <CameraFeed
            onFrameLandmarks={handleFrameLandmarks}
            onFpsUpdate={setFps}
            activeGestureName={gestureResult.gesture}
            activeConfidence={gestureResult.confidence}
          />

          <GestureCard
            currentResult={gestureResult}
            onSimulateGesture={handleSimulateGesture}
          />
        </div>

        {/* Right: Robotic Hand Kinematics Simulator & Command Spec */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <RobotSimulator
            servos={activeCommand.servos}
            activeGesture={activeCommand.gesture}
            activeCommand={activeCommand.command}
            onManualAdjust={handleManualServoAdjust}
          />

          <RobotCommandViewer command={activeCommand} />
        </div>
      </div>

      {/* Motion History & Routine Replay Studio */}
      <div className="w-full">
        <MotionHistory
          history={history}
          onClearHistory={() => setHistory([])}
          onReplayFrame={handleReplayFrame}
          currentGesture={gestureResult.gesture}
          currentServos={activeCommand.servos}
        />
      </div>
    </div>
  );
};
