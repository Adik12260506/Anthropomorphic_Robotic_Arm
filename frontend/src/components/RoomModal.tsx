import React, { useState } from 'react';
import { Copy, Check, Phone, ArrowLeft, Radio, Globe, Link2 } from 'lucide-react';

interface RoomModalProps {
  onJoinRoom: (roomId: string, isHost: boolean) => void;
  onCancel: () => void;
  defaultMode?: 'create' | 'join';
  initialRoomId?: string;
  localIp?: string;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  onJoinRoom,
  onCancel,
  defaultMode = 'create',
  initialRoomId,
  localIp,
}) => {
  const [mode, setMode] = useState<'create' | 'join'>(defaultMode);
  const [roomIdInput, setRoomIdInput] = useState<string>(() => {
    if (initialRoomId) return initialRoomId.toUpperCase();
    return defaultMode === 'create' ? `ROBOT${Math.floor(100 + Math.random() * 900)}` : '';
  });
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = () => {
    if (!roomIdInput) return;
    navigator.clipboard.writeText(roomIdInput.trim().toUpperCase());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!roomIdInput) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/?room=${encodeURIComponent(roomIdInput.trim().toUpperCase())}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
            <h2 className="text-base font-bold tracking-wide uppercase">Two-Device WebRTC Video Call</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
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
            Phone A (Host / Control)
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
              {mode === 'create' ? 'Room Code (Share with second device)' : 'Enter Room Code to Join'}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                placeholder="e.g. ROBOT492"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-cyan-300 font-mono text-base tracking-wider focus:outline-none focus:border-cyan-400"
              />
              {mode === 'create' && (
                <div className="absolute right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 border border-slate-700 transition-colors"
                    title="Copy Room Code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Code'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-xs font-mono flex items-center gap-1 border border-cyan-800/80 transition-colors"
                    title="Copy Direct Invite Link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Link Copied' : 'Link'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Global Network Connectivity Helper */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-cyan-500/20 text-[11px] font-mono text-slate-300 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Globe className="w-3.5 h-3.5" />
              <span>Universal Cloud Calling (Submission Ready):</span>
            </div>
            <div className="text-slate-400 leading-relaxed">
              Anyone anywhere on the internet can connect using this Room Code or link. Works seamlessly across different Wi-Fi networks, mobile 4G/5G carriers, and devices.
            </div>
            {localIp && (
              <div className="text-slate-500 text-[10px] pt-1 border-t border-slate-800">
                Local Wi-Fi Host IP: <span className="text-slate-400">{localIp}</span>
              </div>
            )}
          </div>

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
