import React from 'react';
import type { GestureResult, GestureType } from '../types/robot';
import { GESTURE_DEFINITIONS } from '../robot/gestureCommands';
import { Activity, CheckCircle2, AlertCircle } from 'lucide-react';

interface GestureCardProps {
  currentResult: GestureResult;
  onSimulateGesture?: (gesture: GestureType) => void;
}

export const GestureCard: React.FC<GestureCardProps> = ({
  currentResult,
  onSimulateGesture,
}) => {
  const definition = GESTURE_DEFINITIONS[currentResult.gesture] || GESTURE_DEFINITIONS.UNKNOWN;
  const isHandDetected = currentResult.gesture !== 'NO_HAND';
  const confidencePercent = Math.round(currentResult.confidence * 100);

  // Quick test gesture chips for evaluation / rapid testing
  const testGestures: GestureType[] = [
    'OPEN_HAND',
    'CLOSED_FIST',
    'PINCH',
    'POINTING',
    'THUMBS_UP',
    'PEACE',
    'THREE_FINGERS',
    'OK_SIGN',
  ];

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 text-slate-200 border border-slate-700/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          AI Vision Gesture Engine
        </span>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 border ${
            isHandDetected
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {isHandDetected ? (
            <>
              <CheckCircle2 className="w-3 h-3" />
              Hand Detected
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3" />
              Searching Hand...
            </>
          )}
        </span>
      </div>

      {/* Prominent Gesture Display Box */}
      <div className="bg-slate-900/90 rounded-xl p-4 border border-cyan-500/20 text-center flex flex-col items-center justify-center relative overflow-hidden">
        <span className="text-[10px] font-mono tracking-wider text-cyan-400 uppercase font-semibold">
          GESTURE DETECTED
        </span>

        {/* Big Emoji & Gesture Title */}
        <div className="flex items-center justify-center gap-3 my-2">
          <span className="text-4xl filter drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
            {definition.emoji}
          </span>
          <span className="text-2xl font-bold tracking-tight text-white">
            {definition.displayName}
          </span>
        </div>

        {/* Confidence Meter */}
        <div className="w-full max-w-xs flex flex-col gap-1 mt-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>Confidence</span>
            <span className="text-cyan-400 font-bold">{confidencePercent}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-200"
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>

        {/* Robot Action Tag */}
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-950/60 border border-cyan-800/80 text-xs font-mono text-cyan-300">
          <span className="text-slate-400">Robot Action:</span>
          <span className="font-bold">{definition.command}</span>
        </div>
      </div>

      {/* Finger States Indicator */}
      <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-mono">
        {(['thumb', 'index', 'middle', 'ring', 'little'] as const).map((f) => {
          const isExt = currentResult.fingers[f];
          return (
            <div
              key={f}
              className={`p-1 sm:p-1.5 rounded-lg border transition-colors min-w-0 ${
                isExt
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/80'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800'
              }`}
            >
              <div className="capitalize text-[9px] sm:text-[10px] truncate">{f}</div>
              <div className="font-bold text-[9px] sm:text-[10px] mt-0.5">{isExt ? 'EXT' : 'CURL'}</div>
            </div>
          );
        })}
      </div>

      {/* Quick Test Chips for Evaluators / Reviews */}
      {onSimulateGesture && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800">
          <span className="text-[10px] font-mono text-slate-400">DEMO TEST GESTURES (Click to Trigger):</span>
          <div className="flex flex-wrap gap-1.5">
            {testGestures.map((g) => {
              const def = GESTURE_DEFINITIONS[g];
              const isActive = currentResult.gesture === g;
              return (
                <button
                  key={g}
                  onClick={() => onSimulateGesture(g)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors border ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {def.emoji} {def.displayName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
