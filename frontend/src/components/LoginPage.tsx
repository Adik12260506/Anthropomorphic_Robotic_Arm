import React from 'react';
import { useAuth } from '../context/AuthContext';
import { isCapacitorNative } from '../services/api';
import { Cpu, ShieldCheck, AlertCircle, Bot, Radio, Activity, Fingerprint } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, loading, error, clearError } = useAuth();
  const isNative = isCapacitorNative();

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950 font-sans relative overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header / Branding Bar */}
      <header className="border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-md px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              ROBOTIC ARM VISION
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                {isNative ? 'ANDROID APK' : 'SYSTEM GATEWAY'}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 hidden sm:block">
              AI-Enabled Vision-Based Anthropomorphic System
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>PORTAL SECURE</span>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-md bg-slate-950/80 border border-slate-800/90 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-cyan-950/30 relative">
          {/* Subtle Cyber Corner Accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 rounded-tl-2xl pointer-events-none" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 rounded-tr-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60 rounded-bl-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60 rounded-br-2xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Bot className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-950 border border-emerald-500 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* Title & Description */}
          <div className="text-center mb-6">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide uppercase flex items-center justify-center gap-2">
              Operator Authentication
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Sign in to access robotic telemetry, MediaPipe hand tracking, and 5-channel servo control.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-start justify-between gap-2.5 animate-fadeIn">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              <button
                onClick={clearError}
                className="text-rose-400 hover:text-rose-200 text-xs font-mono px-1 py-0.5 rounded transition-colors"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {/* Primary Action: Google Sign-In */}
          <div className="space-y-4">
            <button
              onClick={() => signInWithGoogle()}
              disabled={loading}
              className="w-full relative group overflow-hidden rounded-xl p-[1px] font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.99]"
            >
              {/* Button gradient border */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 rounded-xl group-hover:opacity-100 opacity-80 transition-opacity" />
              
              <div className="relative px-5 py-3.5 bg-slate-950 rounded-[11px] flex items-center justify-center gap-3 transition-colors group-hover:bg-slate-900/90">
                {loading ? (
                  <div className="flex items-center gap-2.5 text-cyan-400">
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-semibold tracking-wide font-mono">AUTHENTICATING...</span>
                  </div>
                ) : (
                  <>
                    {/* Google 'G' official colored vector icon */}
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span className="text-sm font-semibold text-white tracking-wide">
                      Sign in with Google
                    </span>
                  </>
                )}
              </div>
            </button>

            {/* Verification / Security note */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-500">
              <Fingerprint className="w-3.5 h-3.5 text-cyan-500/70" />
              <span>Firebase Native Authentication • Secure Session</span>
            </div>
          </div>

          {/* Telemetry metadata footer within card */}
          <div className="mt-6 pt-5 border-t border-slate-900 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/60">
              <div className="text-slate-500 flex items-center gap-1">
                <Radio className="w-3 h-3 text-cyan-400" />
                <span>PACKAGE ID</span>
              </div>
              <div className="text-cyan-300 font-semibold truncate mt-0.5">com.roboticarm.vision</div>
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/60">
              <div className="text-slate-500 flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>VISION ENGINE</span>
              </div>
              <div className="text-emerald-300 font-semibold truncate mt-0.5">MediaPipe + WebRTC</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-3 px-4 text-center text-[11px] font-mono text-slate-500 bg-slate-950/40 z-10">
        B.Tech CSE (AI & ML) Engineering Clinics • AI-Enabled Vision-Based Anthropomorphic Robotic Arm
      </footer>
    </div>
  );
};
