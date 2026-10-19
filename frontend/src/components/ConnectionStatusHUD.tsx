import React from 'react';
import type { WebRTCConnectionStatus } from '../types/webrtc';
import { Wifi, Radio, Cpu, Eye, Gauge, Zap, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ConnectionStatusHUDProps {
  fps: number;
  isHandDetected: boolean;
  gestureName: string;
  confidence: number;
  webrtcStatus: WebRTCConnectionStatus;
  apiConnected: boolean;
  latencyMs: number | null;
  robotMode?: 'SIMULATION' | 'ESP32_CONNECTED';
}

export const ConnectionStatusHUD: React.FC<ConnectionStatusHUDProps> = ({
  fps,
  isHandDetected,
  gestureName,
  confidence,
  webrtcStatus,
  apiConnected,
  latencyMs,
  robotMode = 'SIMULATION',
}) => {
  const isLowConfidence = isHandDetected && confidence > 0 && confidence < 0.65;
  const isUnknownGesture = isHandDetected && (gestureName === 'UNKNOWN' || isLowConfidence);

  return (
    <div className="w-full bg-slate-950/90 border-y md:border border-slate-800 md:rounded-xl px-3 py-2 text-slate-300 font-mono text-[11px] backdrop-blur-md">
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 items-center">
        {/* AI Vision Status */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
          <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div className="flex flex-col truncate">
            <span className="text-[9px] text-slate-500 uppercase">Vision Status</span>
            <span
              className={`font-bold truncate ${
                isHandDetected ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {isHandDetected ? '● Hand Tracked' : '○ NO HAND DETECTED'}
            </span>
          </div>
        </div>

        {/* Current Gesture State */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
          {isUnknownGesture ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
          ) : (
            <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          )}
          <div className="flex flex-col truncate">
            <span className="text-[9px] text-slate-500 uppercase">Gesture</span>
            <span
              className={`font-bold truncate ${
                gestureName === 'NO_HAND'
                  ? 'text-slate-400'
                  : isUnknownGesture
                  ? 'text-amber-300'
                  : 'text-cyan-300'
              }`}
            >
              {gestureName === 'NO_HAND'
                ? 'Standby'
                : isUnknownGesture
                ? 'GESTURE UNKNOWN'
                : gestureName}
            </span>
          </div>
        </div>

        {/* Confidence State */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
          <Gauge className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div className="flex flex-col truncate">
            <span className="text-[9px] text-slate-500 uppercase">Confidence</span>
            <span
              className={`font-bold ${
                !isHandDetected
                  ? 'text-slate-500'
                  : isLowConfidence
                  ? 'text-amber-400'
                  : 'text-cyan-300'
              }`}
            >
              {isHandDetected
                ? isLowConfidence
                  ? `LOW (${Math.round(confidence * 100)}%)`
                  : `${Math.round(confidence * 100)}%`
                : 'N/A'}
            </span>
          </div>
        </div>

        {/* FPS Counter */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
          <ActivityIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="flex flex-col truncate">
            <span className="text-[9px] text-slate-500 uppercase">Frame Rate</span>
            <span className="text-emerald-300 font-bold">{fps > 0 ? `${fps} FPS` : 'Standby'}</span>
          </div>
        </div>

        {/* WebRTC Status */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
          <Radio className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <div className="flex flex-col truncate">
            <span className="text-[9px] text-slate-500 uppercase">WebRTC Call</span>
            <span
              className={`font-bold capitalize truncate ${
                webrtcStatus === 'connected'
                  ? 'text-emerald-400'
                  : webrtcStatus === 'waiting_for_peer'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              {webrtcStatus === 'connected'
                ? '● Connected'
                : webrtcStatus === 'disconnected'
                ? '○ WEBRTC DISCONNECTED'
                : webrtcStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* API / Backend Status */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
          <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div className="flex flex-col truncate">
            <span className="text-[9px] text-slate-500 uppercase">Hardware API</span>
            <span className={apiConnected ? 'text-emerald-400 font-bold' : 'text-cyan-400 font-medium'}>
              {apiConnected ? '● Online (LAN)' : '● P2P Direct'}
            </span>
          </div>
        </div>

        {/* Command Latency & Hardware Mode */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800 col-span-2 sm:col-span-1">
          {robotMode === 'ESP32_CONNECTED' ? (
            <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}
          <div className="flex flex-col truncate">
            <span className="text-[9px] text-slate-500 uppercase">Mode</span>
            <span
              className={`font-bold truncate ${
                robotMode === 'ESP32_CONNECTED' ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {robotMode === 'ESP32_CONNECTED' ? 'ESP32 HW' : 'SIMULATION MODE'}
            </span>
            {latencyMs !== null && (
              <span className="text-[9px] text-slate-500">{latencyMs} ms RTT</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function ActivityIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
