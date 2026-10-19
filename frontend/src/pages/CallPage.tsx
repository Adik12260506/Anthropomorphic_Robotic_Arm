import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const currentGestureRef = useRef<GestureType>('NO_HAND');

  // 1. Initialize WebRTC Manager and connect signaling immediately for instant peer discovery
  useEffect(() => {
    const mgr = new WebRTCManager({
      onStatusChange: (status) => setWebrtcStatus(status),
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => {});
        }
      },
      onPeerCountChange: (count) => setPeerCount(count),
      onError: (err) => console.error('WebRTC Call error:', err),
      onTelemetryReady: (ready) => {
        if (ready) setTelemetrySynced(true);
      },
      onRemoteCommand: (cmd) => {
        if (!cmd || !cmd.servos) return;
        setTelemetrySynced(true);
        setActiveCommand(cmd);
        const servos: ServoAngles = cmd.servos;
        const gesture: GestureType = cmd.gesture || 'OPEN_HAND';
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

        // Add to history log on remote viewer
        const now = new Date();
        setHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            timeString: now.toTimeString().split(' ')[0],
            timestamp: Date.now(),
            gesture,
            command: cmd.command || 'REMOTE_P2P_SYNC',
            servos,
          },
          ...prev.slice(0, 49),
        ]);
      },
    });

    webrtcManagerRef.current = mgr;

    // Connect signaling and join room immediately without blocking on camera acquisition
    mgr.startCall(roomId, getWsSignalingUrl(), localStreamRef.current, isHost);

    return () => {
      mgr.endCall();
    };
  }, [roomId, isHost]);

  // Keep remote video srcObject updated without resetting playing streams
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // 2. Phone B: Subscribe to real-time /ws/robot telemetry to mirror Phone A's robot control
  useEffect(() => {
    if (isHost) return; // Phone A transmits; Phone B receives telemetry

    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectTelemetry = () => {
      const wsUrl = getWsRobotUrl();
      if (!wsUrl) {
        // Standalone WebRTC mode: Telemetry is synchronized peer-to-peer via RTCDataChannel and Cloud Signaling
        return;
      }
      try {
        ws = new WebSocket(wsUrl);

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

  // When local camera stream is ready, attach tracks to WebRTC call session
  const handleStreamReady = useCallback((stream: MediaStream) => {
    localStreamRef.current = stream;
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.addLocalStream(stream);
    }
  }, []);

  // Process camera frame landmarks through gesture recognizer & debouncer (Active on Phone A)
  const handleFrameLandmarks = useCallback((landmarks: LandmarkPoint[] | undefined) => {
    // Only Phone A acts as primary vision gesture controller
    if (!isHost) return;

    const raw = defaultGestureRecognizer.recognize(landmarks);
    const stable = debouncer.update(raw);

    if (stable.gesture !== currentGestureRef.current) {
      currentGestureRef.current = stable.gesture;
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

        // Synchronize command peer-to-peer with Phone B via WebRTC DataChannel
        webrtcManagerRef.current?.sendTelemetry(cmd);

        // Transmit command to FastAPI backend (if running with hardware)
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
  }, [isHost, debouncer]);

  const handleSimulateGesture = (gesture: GestureType) => {
    const cmd = mapGestureToRobotCommand(gesture, isHost ? 'Phone-A-Sim' : 'Phone-B-Sim');
    setActiveCommand(cmd);
    webrtcManagerRef.current?.sendTelemetry(cmd);
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
    const updated: RobotCommand = {
      ...activeCommand,
      command: 'MANUAL_OVERRIDE',
      gesture: 'MANUAL',
      servos,
      timestamp: Date.now(),
    };
    setActiveCommand(updated);
    webrtcManagerRef.current?.sendTelemetry(updated);
    ApiService.manualServoAdjust(servos).catch(() => {});
  };

  const handleReplayFrame = (frame: MotionFrame) => {
    const cmd = mapGestureToRobotCommand(frame.gesture, 'Routine-Replay');
    cmd.servos = frame.servos;
    setActiveCommand(cmd);
    webrtcManagerRef.current?.sendTelemetry(cmd);
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
            {/* Local Camera Container (Always mounted so tracks are never destroyed) */}
            <div
              className={
                primaryFeed === 'local'
                  ? 'w-full block relative z-10'
                  : 'absolute bottom-16 right-3 w-36 sm:w-52 aspect-video rounded-xl overflow-hidden glass-panel-glow border-2 border-cyan-500/70 bg-black z-30 shadow-2xl cursor-pointer group transition-all duration-300 hover:scale-105'
              }
              onClick={primaryFeed === 'remote' ? () => setPrimaryFeed('local') : undefined}
              title={primaryFeed === 'remote' ? 'Click to swap to Local Camera' : undefined}
            >
              <CameraFeed
                enableVision={isHost}
                compact={primaryFeed === 'remote'}
                onStreamReady={handleStreamReady}
                onFrameLandmarks={isHost ? handleFrameLandmarks : undefined}
                onFpsUpdate={setFps}
                activeGestureName={gestureResult.gesture}
                activeConfidence={gestureResult.confidence}
              />
              {primaryFeed === 'remote' && (
                <div className="absolute top-1 left-1.5 flex items-center gap-1 bg-slate-900/85 px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300 pointer-events-none">
                  <Camera className="w-2.5 h-2.5" />
                  <span>LOCAL CAM</span>
                </div>
              )}
            </div>

            {/* Remote Peer Video Container (Always mounted so WebRTC decoder is never reset) */}
            <div
              className={
                primaryFeed === 'remote'
                  ? 'relative aspect-video w-full rounded-2xl overflow-hidden glass-panel border border-cyan-500/50 bg-slate-950 flex flex-col items-center justify-center z-10'
                  : 'absolute bottom-16 right-3 w-36 sm:w-52 aspect-video rounded-xl overflow-hidden glass-panel-glow border-2 border-cyan-500/70 bg-black z-30 shadow-2xl cursor-pointer group transition-all duration-300 hover:scale-105'
              }
              onClick={primaryFeed === 'local' ? () => setPrimaryFeed('remote') : undefined}
              title={primaryFeed === 'local' ? 'Click to swap to Remote Video' : undefined}
            >
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Overlays when Remote Video is Primary View */}
              {primaryFeed === 'remote' && (
                <>
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
                </>
              )}

              {/* Waiting overlay for remote stream */}
              {!remoteStream && (
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-3 text-center z-10 ${
                    primaryFeed === 'local' ? 'text-[9px]' : 'p-5'
                  }`}
                >
                  <Radio
                    className={`${
                      primaryFeed === 'local' ? 'w-5 h-5 mb-1' : 'w-10 h-10 mb-3'
                    } text-cyan-400 animate-pulse`}
                  />
                  <h4
                    className={`${
                      primaryFeed === 'local' ? 'text-[10px]' : 'text-sm'
                    } font-mono font-bold text-white uppercase`}
                  >
                    {isHost ? 'Waiting for Phone B' : 'Waiting for Phone A'}
                  </h4>
                  {primaryFeed === 'remote' && (
                    <p className="text-xs font-mono text-slate-400 mt-2 max-w-sm">
                      Connect peer device to Room <span className="text-cyan-400 font-bold">{roomId}</span>.
                      Once connected, video streaming will display here automatically.
                    </p>
                  )}
                </div>
              )}

              {/* PiP mini header when remote is in PiP */}
              {primaryFeed === 'local' && (
                <div className="absolute top-1 left-1.5 flex items-center gap-1 bg-slate-900/85 px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300 z-20 pointer-events-none">
                  <Video className="w-2.5 h-2.5" />
                  <span>{isHost ? 'REMOTE (PHONE B)' : 'REMOTE (PHONE A)'}</span>
                </div>
              )}
            </div>
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

