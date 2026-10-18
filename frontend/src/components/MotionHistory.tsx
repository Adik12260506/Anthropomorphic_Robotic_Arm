import React, { useState, useEffect } from 'react';
import type { CommandHistoryItem, MotionSequence, MotionFrame, ServoAngles, GestureType } from '../types/robot';
import { defaultMotionRecorder, MotionRecorder } from '../robot/motionRecorder';
import { History, Trash2, Play, Square, Circle, Download, Sparkles } from 'lucide-react';

interface MotionHistoryProps {
  history: CommandHistoryItem[];
  onClearHistory: () => void;
  onReplayFrame: (frame: MotionFrame) => void;
  currentGesture: GestureType;
  currentServos: ServoAngles;
}

export const MotionHistory: React.FC<MotionHistoryProps> = ({
  history,
  onClearHistory,
  onReplayFrame,
  currentGesture,
  currentServos,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedSequence, setRecordedSequence] = useState<MotionSequence | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [replayProgress, setReplayProgress] = useState<{ current: number; total: number } | null>(null);

  // Timer for recording duration
  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Feed active frames into recorder if recording is active
  useEffect(() => {
    if (isRecording) {
      defaultMotionRecorder.recordFrame(currentGesture, currentServos);
    }
  }, [isRecording, currentGesture, currentServos]);

  const handleStartRecording = () => {
    defaultMotionRecorder.startRecording();
    setIsRecording(true);
    setRecordedSequence(null);
  };

  const handleStopRecording = () => {
    const seq = defaultMotionRecorder.stopRecording('User Gesture Routine');
    setIsRecording(false);
    setRecordedSequence(seq);
  };

  const handleReplay = (seqToPlay?: MotionSequence) => {
    const targetSeq = seqToPlay || recordedSequence || MotionRecorder.getDemoPreset();
    if (!targetSeq || targetSeq.frames.length === 0) return;

    setIsPlaying(true);
    defaultMotionRecorder.replay(
      targetSeq,
      (frame, index, total) => {
        setReplayProgress({ current: index + 1, total });
        onReplayFrame(frame);
      },
      () => {
        setIsPlaying(false);
        setReplayProgress(null);
      }
    );
  };

  const handleLoadDemoPreset = () => {
    const preset = MotionRecorder.getDemoPreset();
    setRecordedSequence(preset);
    handleReplay(preset);
  };

  const handleExportJson = () => {
    if (!recordedSequence) return;
    const blob = new Blob([JSON.stringify(recordedSequence, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robot-motion-routine-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 text-slate-200 border border-slate-700/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
          <History className="w-3.5 h-3.5 text-cyan-400" />
          <span>MOTION RECORDING & RECENT HISTORY</span>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-red-400 transition-colors"
            title="Clear History"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Motion Recording Studio Card */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase text-cyan-400 font-semibold tracking-wider">
            Motion Sequence Studio
          </span>
          {isRecording && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 bg-red-950/80 px-2 py-0.5 rounded-full border border-red-800 animate-pulse">
              <Circle className="w-2 h-2 fill-red-400" />
              REC {recordingSeconds}s
            </span>
          )}
          {isPlaying && replayProgress && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
              REPLAY {replayProgress.current}/{replayProgress.total}
            </span>
          )}
        </div>

        {/* Action Buttons: START, STOP, REPLAY, PRESET */}
        <div className="flex flex-wrap gap-2">
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              disabled={isPlaying}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-xs font-mono font-semibold transition-colors disabled:opacity-50"
            >
              <Circle className="w-3 h-3 fill-white" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-semibold transition-colors"
            >
              <Square className="w-3 h-3 fill-white" />
              Stop Recording
            </button>
          )}

          <button
            onClick={() => handleReplay()}
            disabled={isRecording || isPlaying}
            className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-mono font-semibold transition-colors disabled:opacity-40"
          >
            <Play className="w-3 h-3 fill-white" />
            Replay Routine
          </button>

          <button
            onClick={handleLoadDemoPreset}
            disabled={isRecording || isPlaying}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition-colors"
            title="Load Pre-programmed Engineering Clinic Routine"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Demo Routine
          </button>

          {recordedSequence && (
            <button
              onClick={handleExportJson}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="Download Routine as JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Real-time Gesture Event Feed */}
      <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
        {history.length === 0 ? (
          <div className="text-center py-6 text-xs font-mono text-slate-500">
            No gesture events recorded yet. Show hand in camera to begin.
          </div>
        ) : (
          history.slice(0, 20).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-xs font-mono bg-slate-900/60 hover:bg-slate-900 p-2 rounded-lg border border-slate-800/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px]">{item.timeString}</span>
                <span className="font-semibold text-cyan-300">{item.gesture}</span>
              </div>
              <div className="text-[11px] text-slate-400">{item.command}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
