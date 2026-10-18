import React, { useState } from 'react';
import { Settings, Wifi, CheckCircle2, AlertCircle, RefreshCw, X, Smartphone, Globe } from 'lucide-react';
import { getApiBaseUrl, setCustomApiUrl, getStoredCustomApiUrl, isCapacitorNative } from '../services/api';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [inputUrl, setInputUrl] = useState<string>(() => getStoredCustomApiUrl() || getApiBaseUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  if (!isOpen) return null;

  const isNative = isCapacitorNative();

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Pinging backend server...');
    let urlToTest = inputUrl.trim();
    if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
      urlToTest = `http://${urlToTest}`;
    }

    try {
      const res = await fetch(`${urlToTest.replace(/\/+$/, '')}/health`, {
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        setTestStatus('success');
        setTestMessage('Successfully connected to FastAPI backend!');
      } else {
        setTestStatus('failed');
        setTestMessage(`Server returned HTTP status ${res.status}`);
      }
    } catch (err: any) {
      setTestStatus('failed');
      setTestMessage(
        err?.name === 'TimeoutError'
          ? 'Connection timed out. Check if phone and computer are on same Wi-Fi.'
          : 'Could not reach server. Verify IP address and port (8000).'
      );
    }
  };

  const handleSave = () => {
    setCustomApiUrl(inputUrl);
    onConfigChanged();
    onClose();
  };

  const handleReset = () => {
    setCustomApiUrl(null);
    setInputUrl(getApiBaseUrl());
    setTestStatus('idle');
    setTestMessage('');
    onConfigChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel-glow w-full max-w-md rounded-2xl border border-cyan-500/40 p-5 bg-slate-950 flex flex-col gap-4 text-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <Settings className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                BACKEND SERVER CONFIGURATION
              </h3>
              <p className="text-[10px] font-mono text-slate-400">
                Configure FastAPI & WebSocket connection endpoint
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Indicator */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            {isNative ? (
              <>
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Android Native (Capacitor)</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Web Browser Environment</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-cyan-400 font-semibold">
            {isNative ? 'APK MODE' : 'WEB MODE'}
          </span>
        </div>

        {/* Explanation for Android Phone users */}
        {isNative && (
          <div className="text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-xl leading-relaxed">
            💡 <strong>Phone Testing Tip:</strong> When running the APK on an Android phone,
            enter your computer's Wi-Fi LAN IP (e.g.{' '}
            <code className="text-white bg-slate-900 px-1 py-0.5 rounded">http://192.168.1.50:8000</code>).
          </div>
        )}

        {/* Input Field */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-mono text-slate-300 font-semibold">
            FastAPI Backend URL:
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setTestStatus('idle');
              }}
              placeholder="http://192.168.1.50:8000 or https://api.yourdomain.com"
              className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-cyan-300 placeholder:text-slate-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Test Connection Button & Result */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !inputUrl.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold border border-slate-700 transition-colors disabled:opacity-50"
            >
              {testStatus === 'testing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  Testing...
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                  Test Connection
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono border border-slate-800 transition-colors"
              title="Reset to default environment URL"
            >
              Reset
            </button>
          </div>

          {testStatus === 'success' && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/50 p-2 rounded-lg border border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{testMessage}</span>
            </div>
          )}

          {testStatus === 'failed' && (
            <div className="flex items-start gap-1.5 text-[11px] font-mono text-rose-300 bg-rose-950/50 p-2 rounded-lg border border-rose-800/60">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{testMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs shadow-lg shadow-cyan-600/30 transition-colors"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};
