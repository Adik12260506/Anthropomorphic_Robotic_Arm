import React, { useState } from 'react';
import { Copy, Check, Phone, ArrowLeft, Radio, Smartphone } from 'lucide-react';

interface RoomModalProps {
  onJoinRoom: (roomId: string, isHost: boolean) => void;
  onCancel: () => void;
  defaultMode?: 'create' | 'join';
  localIp?: string;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  onJoinRoom,
  onCancel,
  defaultMode = 'create',
  localIp,
}) => {
  const [mode, setMode] = useState<'create' | 'join'>(defaultMode);
  const [roomIdInput, setRoomIdInput] = useState<string>(
    defaultMode === 'create' ? `ROBOT${Math.floor(100 + Math.random() * 900)}` : ''
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomIdInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomIdInput.trim()) return;
    onJoinRoom(roomIdInput.trim().toUpperCase(), mode === 'create');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel rounded-3xl p-6 w-full max-w-md border border-cyan-500/30 flex flex-col gap-5 text-slate-100 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h2 className="text-base font-bold tracking-wide uppercase">Two-Phone WebRTC Call</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              if (!roomIdInput) {
                setRoomIdInput(`ROBOT${Math.floor(100 + Math.random() * 900)}`);
              }
            }}
            className={`py-2 rounded-lg text-xs font-mono font-bold transition-all ${
              mode === 'create'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Phone A (Create Room)
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`py-2 rounded-lg text-xs font-mono font-bold transition-all ${
              mode === 'join'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Phone B (Join Room)
          </button>
        </div>

        {/* Room Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-400">
              {mode === 'create' ? 'Generated Room ID (Share with Phone B)' : 'Enter Room ID to Join'}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                placeholder="e.g. ROBOT123"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-cyan-300 font-mono text-base tracking-wider focus:outline-none focus:border-cyan-400"
              />
              {mode === 'create' && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute right-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1"
                  title="Copy Room ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          {/* Wi-Fi / LAN Helper for Phone B */}
          {localIp && (
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Wi-Fi Connection Guide:</span>
              </div>
              <div>
                1. Ensure Phone A and Phone B are on the same Wi-Fi.
              </div>
              <div>
                2. On Phone B, open browser: <span className="text-amber-300 font-bold">http://{localIp}:5173</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4" />
            {mode === 'create' ? 'START CALL AS PHONE A (CONTROL)' : 'JOIN CALL AS PHONE B (VIEWER)'}
          </button>
        </form>
      </div>
    </div>
  );
};
