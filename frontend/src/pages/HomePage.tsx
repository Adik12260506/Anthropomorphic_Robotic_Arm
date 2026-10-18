import React from 'react';
import { Smartphone, Video, Play, Cpu, Sparkles, Activity, ShieldCheck, Wifi } from 'lucide-react';

interface HomePageProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onStartDemo: () => void;
  apiConnected: boolean;
  localIp?: string;
}

export const HomePage: React.FC<HomePageProps> = ({
  onCreateRoom,
  onJoinRoom,
  onStartDemo,
  apiConnected,
  localIp,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-4xl mx-auto w-full">
      {/* Review 2 Banner Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono mb-4 animate-bounce">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>B.Tech CSE (AI & ML) — Engineering Clinics Review 2 Software Prototype</span>
      </div>

      {/* Main Title & Subtitle */}
      <div className="text-center flex flex-col items-center gap-2 max-w-2xl mb-8">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-300 to-teal-200">
          AI-Enabled Vision-Based Anthropomorphic Robotic Arm
        </h1>
        <p className="text-sm sm:text-base text-slate-400 font-mono mt-1">
          Real-Time Vision-Based Human-Robot Interaction
        </p>
      </div>

      {/* Primary Action Card */}
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 w-full max-w-md flex flex-col gap-4 text-center border border-cyan-500/30">
        <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-semibold">
          Select Operation Mode
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {/* 1. DEMO WITHOUT SECOND PHONE (Prominent & instant!) */}
          <button
            onClick={onStartDemo}
            className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-3 group"
          >
            <Play className="w-5 h-5 fill-slate-950 group-hover:scale-110 transition-transform" />
            <div className="flex flex-col text-left">
              <span className="leading-tight">DEMO WITHOUT SECOND PHONE</span>
              <span className="text-[10px] font-mono text-slate-900 font-normal">
                Single device camera + real-time robot arm simulator
              </span>
            </div>
          </button>

          {/* 2. CREATE ROOM (Phone A - Control Side) */}
          <button
            onClick={onCreateRoom}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 font-semibold text-xs tracking-wider font-mono transition-all flex items-center justify-center gap-2.5"
          >
            <Video className="w-4 h-4 text-cyan-400" />
            CREATE ROOM (PHONE A: CONTROL)
          </button>

          {/* 3. JOIN ROOM (Phone B - Remote Observer) */}
          <button
            onClick={onJoinRoom}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-xs tracking-wider font-mono transition-all flex items-center justify-center gap-2.5 hover:border-slate-500"
          >
            <Smartphone className="w-4 h-4 text-slate-400" />
            JOIN ROOM (PHONE B: OBSERVER)
          </button>
        </div>

        {/* Live Network & API Connectivity Status */}
        <div className="mt-2 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Wifi className={`w-3.5 h-3.5 ${apiConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span>FastAPI Backend:</span>
            <span className={apiConnected ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {apiConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {localIp && <span className="text-slate-500">LAN IP: {localIp}</span>}
        </div>
      </div>

      {/* Feature Architecture Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-8">
        <div className="glass-panel p-3.5 rounded-xl border border-slate-800 text-center flex flex-col items-center gap-1">
          <Activity className="w-5 h-5 text-cyan-400 mb-1" />
          <h4 className="text-xs font-bold text-slate-200">MediaPipe Vision</h4>
          <p className="text-[10px] text-slate-400 font-mono">
            21 Hand Landmarks & Joint Angle Geometry
          </p>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-slate-800 text-center flex flex-col items-center gap-1">
          <Cpu className="w-5 h-5 text-emerald-400 mb-1" />
          <h4 className="text-xs font-bold text-slate-200">Robotic Hand Simulator</h4>
          <p className="text-[10px] text-slate-400 font-mono">
            5 Articulated Fingers (MG90S/PCA9685)
          </p>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-slate-800 text-center flex flex-col items-center gap-1">
          <ShieldCheck className="w-5 h-5 text-purple-400 mb-1" />
          <h4 className="text-xs font-bold text-slate-200">WebRTC Dual Call</h4>
          <p className="text-[10px] text-slate-400 font-mono">
            Phone A Control ↔ Phone B Observer
          </p>
        </div>
      </div>
    </div>
  );
};
