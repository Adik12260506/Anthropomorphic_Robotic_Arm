import React, { useState } from 'react';
import type { RobotCommand } from '../types/robot';
import { Check, Copy, ArrowRight, Layers } from 'lucide-react';

interface RobotCommandViewerProps {
  command: RobotCommand;
}

export const RobotCommandViewer: React.FC<RobotCommandViewerProps> = ({ command }) => {
  const [viewMode, setViewMode] = useState<'beginner' | 'json'>('beginner');
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(command, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 text-slate-200 border border-slate-700/80">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>GENERATED ROBOT COMMAND</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
          <button
            onClick={() => setViewMode('beginner')}
            className={`px-2 py-0.5 rounded ${
              viewMode === 'beginner'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Kinematics
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`px-2 py-0.5 rounded ${
              viewMode === 'json'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            JSON Spec
          </button>
        </div>
      </div>

      {/* Beginner & Judge-Friendly Representation */}
      {viewMode === 'beginner' ? (
        <div className="flex flex-col gap-3">
          {/* 3-Step Human -> Software -> Hardware Pipeline Card */}
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Conversion Pipeline
            </span>

            <div className="grid grid-cols-3 gap-2 items-center text-center">
              <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400">1. HUMAN GESTURE</div>
                <div className="text-xs font-bold text-white mt-1">{command.gesture}</div>
              </div>

              <div className="flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-cyan-400 animate-pulse" />
              </div>

              <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400">2. ROBOT ACTION</div>
                <div className="text-xs font-bold text-emerald-400 mt-1">{command.command}</div>
              </div>
            </div>
          </div>

          {/* Individual Servo Angle Mapping (Thumb -> 0°, etc.) */}
          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex flex-col gap-1.5">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex justify-between">
              <span>FINGER / JOINT</span>
              <span>SERVO TARGET (0°–180°)</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
              {[
                { name: 'Thumb', val: command.servos.thumb, ch: 'CH 0' },
                { name: 'Index', val: command.servos.index, ch: 'CH 1' },
                { name: 'Middle', val: command.servos.middle, ch: 'CH 2' },
                { name: 'Ring', val: command.servos.ring, ch: 'CH 3' },
                { name: 'Little', val: command.servos.little, ch: 'CH 4' },
              ].map((item) => (
                <div key={item.name} className="bg-slate-950/90 p-1.5 sm:p-2 rounded-lg border border-slate-800/80 min-w-0">
                  <div className="text-[9px] sm:text-[10px] text-slate-400 truncate">{item.name}</div>
                  <div className="text-xs sm:text-sm font-bold text-cyan-400 mt-0.5">{Math.round(item.val)}°</div>
                  <div className="text-[8px] sm:text-[9px] text-slate-500">{item.ch}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Structured JSON Output */
        <div className="relative bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Copy JSON Payload"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <pre className="text-[11px] leading-relaxed select-all">{jsonString}</pre>
        </div>
      )}
    </div>
  );
};
