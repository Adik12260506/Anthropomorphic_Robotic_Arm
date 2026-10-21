import React, { useState } from 'react';
import type { ServoAngles } from '../types/robot';
import { Sliders, Cpu } from 'lucide-react';

interface RobotSimulatorProps {
  servos: ServoAngles;
  activeGesture?: string;
  activeCommand?: string;
  onManualAdjust?: (servos: ServoAngles) => void;
  esp32Mode?: 'SIMULATION' | 'ESP32_CONNECTED';
}

interface FingerConfig {
  name: string;
  key: keyof ServoAngles;
  channel: string;
  color: string;
  baseX: number;
  baseY: number;
  baseAngle: number;
  length: number;
}

export const RobotSimulator: React.FC<RobotSimulatorProps> = ({
  servos,
  activeCommand = 'OPEN_ALL_FINGERS',
  onManualAdjust,
  esp32Mode = 'SIMULATION',
}) => {
  const [showManualControls, setShowManualControls] = useState(false);

  // Configuration for each robotic finger on the palm chassis
  const fingerConfigs: FingerConfig[] = [
    { name: 'Thumb', key: 'thumb', channel: 'CH 0', color: '#f59e0b', baseX: 70, baseY: 175, baseAngle: -38, length: 28 },
    { name: 'Index', key: 'index', channel: 'CH 1', color: '#00f0ff', baseX: 105, baseY: 115, baseAngle: -10, length: 34 },
    { name: 'Middle', key: 'middle', channel: 'CH 2', color: '#10b981', baseX: 140, baseY: 105, baseAngle: 0, length: 38 },
    { name: 'Ring', key: 'ring', channel: 'CH 3', color: '#a855f7', baseX: 175, baseY: 115, baseAngle: 8, length: 33 },
    { name: 'Little', key: 'little', channel: 'CH 4', color: '#ec4899', baseX: 210, baseY: 135, baseAngle: 18, length: 26 },
  ];

  const handleSliderChange = (finger: keyof ServoAngles, val: number) => {
    if (onManualAdjust) {
      onManualAdjust({
        ...servos,
        [finger]: val,
      });
    }
  };

  /**
   * Render an articulated 3-segment mechanical finger.
   * Forward kinematics: rotation angle curls the joints inward.
   */
  const renderFinger = (cfg: FingerConfig) => {
    const angleDeg = servos[cfg.key] || 0;
    // Normalized flexion: 0 (straight open at 0°) -> 1.0 (fully curled closed at 180°)
    const flexion = Math.min(1.0, Math.max(0, angleDeg / 180));

    const segLen = cfg.length;
    // Joint angles bend progressively based on servo rotation (full 180° curl)
    const baseRot = cfg.baseAngle;
    const jointCurl = flexion * 65; // Increased for full 180° anatomical closure

    // Segment 1 (Proximal)
    const rad1 = ((baseRot - jointCurl * 0.5) * Math.PI) / 180;
    const x1 = cfg.baseX + Math.sin(rad1) * segLen;
    const y1 = cfg.baseY - Math.cos(rad1) * segLen;

    // Segment 2 (Intermediate)
    const rad2 = ((baseRot - jointCurl * 1.3) * Math.PI) / 180;
    const x2 = x1 + Math.sin(rad2) * (segLen * 0.85);
    const y2 = y1 - Math.cos(rad2) * (segLen * 0.85);

    // Segment 3 (Distal / Fingertip)
    const rad3 = ((baseRot - jointCurl * 2.1) * Math.PI) / 180;
    const x3 = x2 + Math.sin(rad3) * (segLen * 0.7);
    const y3 = y2 - Math.cos(rad3) * (segLen * 0.7);

    return (
      <g key={cfg.name} className="transition-all duration-150 ease-out">
        {/* Joint Lines (Metallic robotic segments) */}
        <line x1={cfg.baseX} y1={cfg.baseY} x2={x1} y2={y1} stroke="#334155" strokeWidth="9" strokeLinecap="round" />
        <line x1={cfg.baseX} y1={cfg.baseY} x2={x1} y2={y1} stroke={cfg.color} strokeWidth="5" strokeLinecap="round" />

        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth="7" strokeLinecap="round" />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={cfg.color} strokeWidth="4" strokeLinecap="round" />

        <line x1={x2} y1={y2} x2={x3} y2={y3} stroke="#334155" strokeWidth="6" strokeLinecap="round" />
        <line x1={x2} y1={y2} x2={x3} y2={y3} stroke={cfg.color} strokeWidth="3" strokeLinecap="round" />

        {/* Joint Nodes (Pivots) */}
        <circle cx={cfg.baseX} cy={cfg.baseY} r="5" fill="#0f172a" stroke={cfg.color} strokeWidth="2" />
        <circle cx={x1} cy={y1} r="4" fill="#0f172a" stroke={cfg.color} strokeWidth="1.5" />
        <circle cx={x2} cy={y2} r="3.5" fill="#0f172a" stroke={cfg.color} strokeWidth="1.5" />

        {/* Fingertip Sensor Cap */}
        <circle cx={x3} cy={y3} r="4" fill={cfg.color} className="animate-pulse" />
      </g>
    );
  };

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4 text-slate-200">
      {/* Header & Hardware Mode Badge */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-semibold tracking-wider text-slate-100 uppercase">
            Anthropomorphic Hand Simulator
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              esp32Mode === 'ESP32_CONNECTED'
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700'
                : 'bg-amber-950/80 text-amber-300 border-amber-800'
            }`}
          >
            {esp32Mode === 'ESP32_CONNECTED' ? '● ESP32 ONLINE' : '● SIMULATION MODE'}
          </span>
          <button
            onClick={() => setShowManualControls(!showManualControls)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showManualControls
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Manual Servo Sliders"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Simulator Grid: Visual Model + Servo Meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Visual 2D Articulated Robotic Hand Model */}
        <div className="relative flex items-center justify-center bg-slate-950/80 rounded-xl border border-slate-800/80 p-2 overflow-hidden min-h-[260px]">
          {/* Futuristic Circuit Grid Background */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(#00f0ff 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />

          <svg viewBox="0 0 280 290" className="w-full max-w-[260px] h-auto select-none">
            {/* Wrist / Forearm Mount */}
            <path
              d="M 95 240 L 185 240 L 175 285 L 105 285 Z"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2"
            />
            <text x="140" y="270" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
              MG90S / PCA9685
            </text>

            {/* Palm Chassis */}
            <path
              d="M 65 180 C 65 140, 90 120, 105 115 L 140 105 L 175 115 L 210 135 C 225 155, 220 200, 185 240 L 95 240 C 75 220, 65 200, 65 180 Z"
              fill="#1e293b"
              stroke="#00f0ff"
              strokeWidth="1.5"
              className="filter drop-shadow-[0_0_8px_rgba(0,240,255,0.15)]"
            />

            {/* Palm Circuit Decals */}
            <circle cx="140" cy="170" r="18" fill="#0f172a" stroke="#334155" strokeWidth="2" />
            <circle cx="140" cy="170" r="12" fill="none" stroke="#00f0ff" strokeWidth="1" strokeDasharray="3 3" />
            <text x="140" y="174" textAnchor="middle" fill="#00f0ff" fontSize="10" fontWeight="bold" fontFamily="monospace">
              ROBOT
            </text>

            {/* 5 Articulated Fingers */}
            {fingerConfigs.map(renderFinger)}
          </svg>

          {/* Action Overlay Tag */}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[11px] font-mono px-2 py-1 rounded bg-slate-900/90 border border-slate-800">
            <span className="text-slate-400">Action:</span>
            <span className="text-cyan-400 font-bold truncate max-w-[170px]">{activeCommand}</span>
          </div>
        </div>

        {/* Servo Angle Gauges & Degree Readings */}
        <div className="flex flex-col gap-2.5">
          <div className="text-[11px] font-mono text-slate-400 flex justify-between px-1">
            <span>FINGER / SERVO</span>
            <span>ANGLE / PWM</span>
          </div>

          {fingerConfigs.map((cfg) => {
            const angle = Math.round(servos[cfg.key] || 0);
            const percentage = Math.min(100, Math.round((angle / 180) * 100));

            return (
              <div key={cfg.name} className="flex flex-col gap-1 bg-slate-900/70 p-2 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    <span className="text-slate-300 font-medium">{cfg.name}</span>
                    <span className="text-[10px] text-slate-500">({cfg.channel})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold text-sm">{angle}°</span>
                    <span className="text-[10px] text-slate-500">{percentage}%</span>
                  </div>
                </div>

                {/* Animated Servo Bar */}
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200 ease-out"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: cfg.color,
                      boxShadow: `0 0 6px ${cfg.color}80`,
                    }}
                  />
                </div>

                {/* Manual Slider if enabled */}
                {showManualControls && (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="180"
                      value={angle}
                      onChange={(e) => handleSliderChange(cfg.key, Number(e.target.value))}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
