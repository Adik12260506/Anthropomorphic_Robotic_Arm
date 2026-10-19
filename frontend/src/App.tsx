import { useState, useEffect, useCallback } from 'react';
import { HomePage } from './pages/HomePage';
import { CallPage } from './pages/CallPage';
import { RobotDashboardPage } from './pages/RobotDashboardPage';
import { RoomModal } from './components/RoomModal';
import { ServerConfigModal } from './components/ServerConfigModal';
import { ApiService, isCapacitorNative } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Cpu, Settings, LogOut, User as UserIcon } from 'lucide-react';

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'home' | 'call' | 'demo'>('home');
  const [showRoomModal, setShowRoomModal] = useState<boolean>(false);
  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'join'>('create');
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [isRoomHost, setIsRoomHost] = useState<boolean>(true);
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [localIp, setLocalIp] = useState<string>('');

  const isNative = isCapacitorNative();

  // Check backend health and fetch LAN IP info periodically
  const checkServer = useCallback(async () => {
    const ok = await ApiService.checkHealth();
    setApiConnected(ok);
    if (ok) {
      try {
        const info = await ApiService.getNetworkInfo();
        setLocalIp(info.local_ip);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    // Automatically detect room code from invite URL (e.g. ?room=ROBOT123)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam && roomParam.trim().length > 0) {
        setCurrentRoomId(roomParam.trim().toUpperCase());
        setModalMode('join');
        setShowRoomModal(true);
      }
    }
  }, []);

  useEffect(() => {
    checkServer();
    const interval = setInterval(checkServer, 4000);

    const handleUrlChanged = () => {
      checkServer();
    };
    window.addEventListener('robot-api-url-changed', handleUrlChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('robot-api-url-changed', handleUrlChanged);
    };
  }, [checkServer]);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setShowRoomModal(true);
  };

  const handleOpenJoinModal = () => {
    setModalMode('join');
    setShowRoomModal(true);
  };

  const handleJoinRoom = (roomId: string, isHost: boolean) => {
    setCurrentRoomId(roomId);
    setIsRoomHost(isHost);
    setShowRoomModal(false);
    setCurrentView('call');
  };

  const handleStartDemo = () => {
    setCurrentView('demo');
  };

  const handleEndCall = () => {
    setCurrentView('home');
    setCurrentRoomId('');
  };

  // Loading state while restoring auth session
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20 mb-4 animate-pulse">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Cpu className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        </div>
        <div className="text-xs font-mono tracking-widest text-cyan-400">INITIALIZING ROBOT SECURITY...</div>
      </div>
    );
  }

  // Gate access behind Google Authentication
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950 font-sans">
      {/* Universal Top Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-4 py-2.5 flex items-center justify-between">
        <div
          onClick={() => setCurrentView('home')}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              ROBOTIC ARM VISION
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                {isNative ? 'ANDROID APK' : 'REVIEW 2'}
              </span>
            </span>
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
              AI-Enabled Vision-Based Anthropomorphic System
            </span>
          </div>
        </div>

        {/* Status Indicators, Server Config Trigger & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowServerModal(true)}
            className="flex items-center gap-1.5 text-[11px] font-mono bg-slate-900/90 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-800 transition-colors"
            title="Click to configure backend IP / URL"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                apiConnected ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
              }`}
            />
            <span className={apiConnected ? 'text-slate-300' : 'text-rose-300'}>
              {apiConnected ? 'API Active' : 'API Offline'}
            </span>
            <Settings className="w-3 h-3 text-slate-400 ml-1" />
          </button>

          {localIp && (
            <span className="text-[10px] font-mono text-cyan-400/80 hidden md:inline bg-slate-900/50 px-2 py-1 rounded border border-slate-800">
              IP: {localIp}
            </span>
          )}

          {/* User Profile Badge & Sign Out */}
          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 border-l border-slate-800">
              <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800/90 rounded-lg py-1 px-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-5 h-5 rounded-full object-cover border border-cyan-500/40"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center">
                    <UserIcon className="w-3 h-3 text-cyan-400" />
                  </div>
                )}
                <span className="text-[11px] font-mono text-slate-200 max-w-[80px] sm:max-w-[130px] truncate">
                  {user.displayName || user.email?.split('@')[0] || 'Operator'}
                </span>
              </div>

              <button
                onClick={() => signOut()}
                className="flex items-center gap-1 text-[11px] font-mono bg-slate-900/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/80 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {currentView === 'home' && (
          <HomePage
            onCreateRoom={handleOpenCreateModal}
            onJoinRoom={handleOpenJoinModal}
            onStartDemo={handleStartDemo}
            apiConnected={apiConnected}
            localIp={localIp}
          />
        )}

        {currentView === 'call' && (
          <CallPage
            roomId={currentRoomId}
            isHost={isRoomHost}
            onEndCall={handleEndCall}
            apiConnected={apiConnected}
          />
        )}

        {currentView === 'demo' && (
          <RobotDashboardPage
            onBackToHome={() => setCurrentView('home')}
            apiConnected={apiConnected}
          />
        )}
      </main>

      {/* Modal for Creating or Joining Room */}
      {showRoomModal && (
        <RoomModal
          defaultMode={modalMode}
          initialRoomId={currentRoomId}
          onJoinRoom={handleJoinRoom}
          onCancel={() => setShowRoomModal(false)}
          localIp={localIp}
        />
      )}

      {/* Modal for Configuring Backend Server URL (Local Wi-Fi IP / Cloud) */}
      <ServerConfigModal
        isOpen={showServerModal}
        onClose={() => setShowServerModal(false)}
        onConfigChanged={() => checkServer()}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-3 px-4 text-center text-[11px] font-mono text-slate-500 bg-slate-950/40">
        B.Tech CSE (AI & ML) Engineering Clinics • Anthropomorphic Hand Hardware: PCA9685 + MG90S Servos (Phase 3 Integration Pending)
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
