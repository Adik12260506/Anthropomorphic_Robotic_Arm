import React, { useState, useEffect, useRef } from 'react';
import { CameraFeed } from '../components/CameraFeed';
import { GestureCard } from '../components/GestureCard';
import { RobotCommandViewer } from '../components/RobotCommandViewer';
import { RobotSimulator } from '../components/RobotSimulator';
import { MotionHistory } from '../components/MotionHistory';
import { ConnectionStatusHUD } from '../components/ConnectionStatusHUD';
import { WebRTCManager } from '../webrtc/webrtcManager';
import { getWsSignalingUrl, getWsRobotUrl, ApiService } from '../services/api';
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
import type { WebRTCConnectionStatus } from '../types/webrtc';
import { PhoneOff, Video, Radio, ArrowLeftRight, Eye, Camera, Cpu } from 'lucide-react';

interface CallPageProps {
  roomId: string;
  isHost: boolean; // true = Phone A (Control Side), false = Phone B (Observer / Reviewer Side)
  onEndCall: () => void;
  apiConnected: boolean;
}

export const CallPage: React.FC<CallPageProps> = ({
  roomId,
  isHost,
  onEndCall,
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
    mapGestureToRobotCommand('OPEN_HAND', isHost ? 'Phone-A' : 'Phone-B')
  );

  // View presentation state: Phone A defaults to local camera focus, Phone B defaults to remote robot view
  const [primaryFeed, setPrimaryFeed] = useState<'local' | 'remote'>(isHost ? 'local' : 'remote');

  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [webrtcStatus, setWebrtcStatus] = useState<WebRTCConnectionStatus>('connecting');
  const [telemetrySynced, setTelemetrySynced] = useState<boolean>(false);
  const [peerCount, setPeerCount] = useState(1);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // 1. Initialize WebRTC Manager for 2-phone video exchange
  useEffect(() => {
    const mgr = new WebRTCManager({
      onStatusChange: (status) => setWebrtcStatus(status),
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onPeerCountChange: (count) => setPeerCount(count),
      onError: (err) => console.error('WebRTC Call error:', err),
    });

    webrtcManagerRef.current = mgr;

    return () => {
      mgr.endCall();
    };
  }, []);

  // Keep remote video srcObject updated when remoteStream or primaryFeed changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, primaryFeed]);

  // 2. Phone B: Subscribe to real-time /ws/robot telemetry to mirror Phone A's robot control
  useEffect(() => {
    if (isHost) return; // Phone A transmits; Phone B receives telemetry

    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectTelemetry = () => {
      try {
        ws = new WebSocket(getWsRobotUrl());

        ws.onopen = () => {
          setTelemetrySynced(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'state_update' && data.state) {
              const st = data.state;
              const servos: ServoAngles = st.servos || {
                thumb: 0,
                index: 0,
                middle: 0,
                ring: 0,
                little: 0,
              };
              const gesture: GestureType = (st.last_gesture as GestureType) || 'OPEN_HAND';
              const command: string = st.last_command || 'SYNCED_STATE';

              setActiveCommand({
                gesture,
                command,
                servos,
                timestamp: st.updated_at ? Math.round(st.updated_at * 1000) : Date.now(),
                client_id: 'Phone-A-Vision',
              });

              setGestureResult({
                gesture,
                confidence: 0.98,
                fingers: {
                  thumb: servos.thumb < 90,
                  index: servos.index < 90,
                  middle: servos.middle < 90,
                  ring: servos.ring < 90,
                  little: servos.little < 90,
                },
                timestamp: Date.now(),
              });

              // Add to history log on Phone B
              const now = new Date();
              setHistory((prev) => [
                {
                  id: `${Date.now()}-${Math.random()}`,
                  timeString: now.toTimeString().split(' ')[0],
                  timestamp: Date.now(),
                  gesture,
                  command,
                  servos,
                },
                ...prev.slice(0, 49),
              ]);
            }
          } catch (err) {
            console.error('Error parsing telemetry update:', err);
          }
        };

        ws.onerror = () => {
          setTelemetrySynced(false);
        };

        ws.onclose = () => {
          setTelemetrySynced(false);
          reconnectTimer = setTimeout(connectTelemetry, 3000);
        };
      } catch {
        setTelemetrySynced(false);
        reconnectTimer = setTimeout(connectTelemetry, 3000);
      }
    };

    connectTelemetry();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [isHost]);

  // When local camera stream is ready, begin WebRTC call session
  const handleStreamReady = (stream: MediaStream) => {
    localStreamRef.current = stream;
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.startCall(roomId, getWsSignalingUrl(), stream, isHost);
    }
  };

  // Process camera frame landmarks through gesture recognizer & debouncer (Active on Phone A)
  const handleFrameLandmarks = (landmarks: LandmarkPoint[] | undefined) => {
    // Only Phone A acts as primary vision gesture controller
    if (!isHost) return;

    const raw = defaultGestureRecognizer.recognize(landmarks);
    const stable = debouncer.update(raw);

    if (stable.gesture !== gestureResult.gesture) {
      setGestureResult(stable);

      // Safety check: Only generate and transmit robot commands if gesture is recognized and confident
      if (isValidRobotGesture(stable.gesture, stable.confidence)) {
        const cmd = mapGestureToRobotCommand(stable.gesture, 'Phone-A-Vision');
        setActiveCommand(cmd);

        // Record into history
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

        // Transmit command to FastAPI backend (which broadcasts to Phone B via /ws/robot)
        const sendStart = performance.now();
        ApiService.sendRobotCommand(cmd)
          .then(() => {
            const rtt = Math.round(performance.now() - sendStart);
            setLatencyMs(rtt);
          })
          .catch(() => {
            setLatencyMs(null);
          });
      }
    }
  };

  const handleSimulateGesture = (gesture: GestureType) => {
    const cmd = mapGestureToRobotCommand(gesture, isHost ? 'Phone-A-Sim' : 'Phone-B-Sim');
    setActiveCommand(cmd);
    setGestureResult({
      gesture,
      confidence: 0.98,
      fingers: {
        thumb: cmd.servos.thumb === 0,
        index: cmd.servos.index === 0,
        middle: cmd.servos.middle === 0,
        ring: cmd.servos.ring === 0,
        little: cmd.servos.little === 0,
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
        thumb: frame.servos.thumb === 0,
        index: frame.servos.index === 0,
        middle: frame.servos.middle === 0,
        ring: frame.servos.ring === 0,
        little: frame.servos.little === 0,
      },
      timestamp: Date.now(),
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 p-3 sm:p-5 max-w-7xl mx-auto w-full">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/85 p-3 sm:p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-white tracking-wide">
                ROOM: <span className="text-cyan-400">{roomId}</span>
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isHost
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                }`}
              >
                {isHost ? '📱 PHONE A (CONTROL SIDE)' : '📱 PHONE B (OBSERVER / REVIEWER)'}
              </span>
              {!isHost && (
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                    telemetrySynced
                      ? 'bg-emerald-900/60 text-emerald-300 border-emerald-600/60'
                      : 'bg-amber-900/60 text-amber-300 border-amber-600/60'
                  }`}
                >
                  {telemetrySynced ? '● TELEMETRY SYNCED' : '○ CONNECTING TELEMETRY'}
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">
              {peerCount > 1
                ? '● 2 Devices Connected in Real-Time WebRTC Call'
                : '○ Waiting for second device to connect to room...'}
            </span>
          </div>
        </div>

        {/* View Toggle & End Call Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrimaryFeed((prev) => (prev === 'local' ? 'remote' : 'local'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold border border-slate-700 transition-colors"
            title="Swap which video feed is primary"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Swap Feeds</span>
          </button>

          <button
            onClick={onEndCall}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-red-600/20"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </div>

      {/* Real-Time Telemetry HUD Bar */}
      <ConnectionStatusHUD
        fps={fps}
        isHandDetected={gestureResult.gesture !== 'NO_HAND'}
        gestureName={gestureResult.gesture}
        confidence={gestureResult.confidence}
        webrtcStatus={webrtcStatus}
        apiConnected={apiConnected}
        latencyMs={latencyMs}
      />

      {/* Main Video & Camera Dual-Feed Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Primary Video / Camera Column */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative">
            {/* Primary View: Can be Local Camera (default on Phone A) or Remote Video (default on Phone B) */}
            {primaryFeed === 'local' ? (
              <div>
                <CameraFeed
                  onStreamReady={handleStreamReady}
                  onFrameLandmarks={isHost ? handleFrameLandmarks : undefined}
                  onFpsUpdate={setFps}
                  activeGestureName={gestureResult.gesture}
                  activeConfidence={gestureResult.confidence}
                />

                {/* PiP Floating Window: Remote Video Feed */}
                <div
                  onClick={() => setPrimaryFeed('remote')}
                  className="absolute bottom-16 right-3 w-36 sm:w-48 aspect-video rounded-xl overflow-hidden glass-panel-glow border border-cyan-500/50 bg-black z-30 shadow-2xl cursor-pointer group transition-transform hover:scale-105"
                  title="Click to switch to Remote Feed"
                >
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1.5 flex items-center gap-1 bg-slate-900/85 px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300">
                    <Video className="w-2.5 h-2.5" />
                    <span>{isHost ? 'REMOTE (PHONE B)' : 'REMOTE (PHONE A)'}</span>
                  </div>
                  {!remoteStream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 p-2 text-center text-[9px] font-mono text-slate-400">
                      <span>Waiting for peer stream...</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Primary View: Remote Video Feed (Full Screen for Phone B Reviewer) */
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden glass-panel border border-cyan-500/50 bg-slate-950 flex flex-col items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Cybernetic Scanline */}
                <div className="hud-scanline" />

                {/* Top Badges for Remote Feed */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-20 pointer-events-none">
                  <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-cyan-500/40 px-3 py-1 rounded-xl shadow-lg">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        remoteStream ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                      }`}
                    />
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {remoteStream
                        ? isHost
                          ? '● REMOTE PEER VIEW (PHONE B)'
                          : '● REMOTE ROBOT VIEW (PHONE A CONTROLLER)'
                        : 'WAITING FOR PEER VIDEO STREAM...'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 px-2.5 py-1 rounded-xl">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-mono text-slate-300">
                      {isHost ? 'OBSERVER FEED' : 'VISION FEED'}
                    </span>
                  </div>
                </div>

                {/* Telemetry HUD Overlay at bottom of Remote Stream */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-xl z-20 flex flex-wrap items-center justify-between gap-2 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-slate-400">DETECTED GESTURE</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {gestureResult.gesture}
                      </span>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-700" />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-slate-400">ROBOT COMMAND</span>
                      <span className="text-xs font-mono font-bold text-cyan-400">
                        {activeCommand.command}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-300 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800">
                    <Cpu className="w-3 h-3 text-cyan-400" />
                    <span className="text-cyan-400 font-bold">SERVOS:</span>
                    <span>T:{activeCommand.servos.thumb}°</span>
                    <span>I:{activeCommand.servos.index}°</span>
                    <span>M:{activeCommand.servos.middle}°</span>
                    <span>R:{activeCommand.servos.ring}°</span>
                    <span>L:{activeCommand.servos.little}°</span>
                  </div>
                </div>

                {!remoteStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-5 text-center z-10">
                    <Radio className="w-10 h-10 text-cyan-400 animate-pulse mb-3" />
                    <h4 className="text-sm font-mono font-bold text-white uppercase">
                      Waiting for Phone A Video Stream
                    </h4>
                    <p className="text-xs font-mono text-slate-400 mt-2 max-w-sm">
                      Connect Phone A to Room <span className="text-cyan-400 font-bold">{roomId}</span>.
                      Once Phone A begins video streaming, it will appear here automatically.
                    </p>
                  </div>
                )}

                {/* PiP Floating Window: Local Camera Feed */}
                <div
                  onClick={() => setPrimaryFeed('local')}
                  className="absolute bottom-16 right-3 w-36 sm:w-48 rounded-xl overflow-hidden glass-panel-glow border border-slate-700 bg-black z-30 shadow-2xl cursor-pointer group transition-transform hover:scale-105"
                  title="Click to switch to Local Camera"
                >
                  <div className="relative aspect-video">
                    {/* Render CameraFeed in background or mini mode */}
                    <div className="w-full h-full scale-[0.6] origin-top-left pointer-events-none">
                      <CameraFeed
                        onStreamReady={handleStreamReady}
                        onFrameLandmarks={isHost ? handleFrameLandmarks : undefined}
                        onFpsUpdate={setFps}
                        activeGestureName={gestureResult.gesture}
                        activeConfidence={gestureResult.confidence}
                      />
                    </div>
                    <div className="absolute top-1 left-1.5 flex items-center gap-1 bg-slate-900/85 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-200">
                      <Camera className="w-2.5 h-2.5" />
                      <span>LOCAL CAM</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Prominent Gesture Display Card */}
          <GestureCard
            currentResult={gestureResult}
            onSimulateGesture={handleSimulateGesture}
          />
        </div>

        {/* Right Column: Anthropomorphic Hand Simulator & Structured Command */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Anthropomorphic Hand Visual Simulator */}
          <RobotSimulator
            servos={activeCommand.servos}
            activeGesture={activeCommand.gesture}
            activeCommand={activeCommand.command}
            onManualAdjust={handleManualServoAdjust}
          />

          {/* Generated Robot Command (Kinematics + JSON Spec) */}
          <RobotCommandViewer command={activeCommand} />
        </div>
      </div>

      {/* Motion History & Routine Studio */}
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

