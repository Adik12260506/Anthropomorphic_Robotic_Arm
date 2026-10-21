/**
 * Backend API & WebSocket Service.
 * Configurable via environment variables (VITE_API_URL, VITE_WS_URL, VITE_SIGNALING_URL)
 * or runtime user configuration stored in localStorage (ideal for Android testing on local Wi-Fi),
 * with automatic protocol and host fallback for localhost and LAN development.
 */

import type { RobotCommand, RobotState, ServoAngles } from '../types/robot';

const STORAGE_KEY_API_URL = 'ROBOT_ARM_CUSTOM_API_URL';

/**
 * Detect if running inside Capacitor Android native webview.
 */
export const isCapacitorNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    (window.location.protocol === 'https:' && window.location.hostname === 'localhost' && navigator.userAgent.includes('Android'))
  );
};

/**
 * Resolves the active API Base URL.
 * Priority:
 * 1. User manual override stored in localStorage (e.g. entered via Android settings modal)
 * 2. import.meta.env.VITE_API_URL
 * 3. import.meta.env.VITE_BACKEND_URL
 * 4. Runtime window.location detection (with fallback to http://localhost:8000)
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_KEY_API_URL);
    if (custom && custom.trim().length > 0) {
      return custom.trim().replace(/\/+$/, '');
    }
  }

  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const proto = isHttps ? 'https:' : 'http:';
    const host = window.location.hostname;

    // Detect private LAN IPs (e.g. 192.168.x.x, 10.x.x.x, 172.16-31.x.x, or .local)
    const isLanIp = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|\.local$/.test(host);
    if (isLanIp) {
      return `${proto}//${host}:8000`;
    }

    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000';
    }

    // On public web deployments (e.g. vercel.app), do not append port 8000
    return '';
  }

  return 'http://localhost:8000';
}

/**
 * Returns the WebSocket URL for robot telemetry.
 */
export function getWsRobotUrl(): string {
  const envWs = import.meta.env.VITE_WS_URL;
  if (envWs && envWs.trim().length > 0) {
    return envWs.trim();
  }

  const apiBase = getApiBaseUrl();
  if (!apiBase) return '';
  const wsProto = apiBase.startsWith('https:') ? 'wss:' : 'ws:';
  return `${apiBase.replace(/^https?:/, wsProto)}/ws/robot`;
}

/**
 * Returns the WebSocket base URL for WebRTC room signaling.
 */
export function getWsSignalingUrl(): string {
  const envSignaling = import.meta.env.VITE_SIGNALING_URL;
  if (envSignaling && envSignaling.trim().length > 0) {
    return envSignaling.trim();
  }

  const apiBase = getApiBaseUrl();
  if (!apiBase) return '';
  const wsProto = apiBase.startsWith('https:') ? 'wss:' : 'ws:';
  return `${apiBase.replace(/^https?:/, wsProto)}/ws/signaling`;
}

/**
 * Update custom runtime API URL in localStorage (persists on Android).
 */
export function setCustomApiUrl(url: string | null): void {
  if (typeof window === 'undefined') return;
  if (!url || url.trim().length === 0) {
    localStorage.removeItem(STORAGE_KEY_API_URL);
  } else {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    localStorage.setItem(STORAGE_KEY_API_URL, clean);
  }
  window.dispatchEvent(new CustomEvent('robot-api-url-changed', { detail: getApiBaseUrl() }));
}

/**
 * Get stored custom API URL, if any.
 */
export function getStoredCustomApiUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_API_URL);
}

// Backward-compatible exported properties
export const API_BASE_URL = getApiBaseUrl();
export const WS_ROBOT_URL = getWsRobotUrl();
export const WS_SIGNALING_BASE_URL = getWsSignalingUrl();

export class ApiService {
  public static async checkHealth(): Promise<boolean> {
    try {
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) return false;
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async getStatus(): Promise<any> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return { status: 'client_p2p_active' };
    const res = await fetch(`${baseUrl}/api/status`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  }

  public static async getNetworkInfo(): Promise<{ local_ip: string; frontend_mobile_url: string }> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return { local_ip: '', frontend_mobile_url: '' };
    const res = await fetch(`${baseUrl}/api/network/info`);
    if (!res.ok) throw new Error('Failed to fetch network info');
    return res.json();
  }

  public static async getRobotState(): Promise<RobotState> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) {
      return {
        mode: 'SIMULATION',
        servos: { thumb: 180, index: 180, middle: 180, ring: 180, little: 180 },
        last_gesture: 'OPEN_HAND',
        last_command: 'IDLE',
        hardware_target: 'WebRTC P2P',
        updated_at: Date.now() / 1000,
        is_connected: true,
      };
    }
    const res = await fetch(`${baseUrl}/api/robot/state`);
    if (!res.ok) throw new Error('Failed to fetch robot state');
    return res.json();
  }

  public static async sendRobotCommand(cmd: RobotCommand): Promise<any> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return { status: 'client_p2p_active' };
    try {
      const res = await fetch(`${baseUrl}/api/robot/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
      });
      if (!res.ok) return { status: 'offline' };
      return res.json();
    } catch {
      return { status: 'offline' };
    }
  }

  public static async manualServoAdjust(servos: ServoAngles): Promise<any> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return { status: 'client_p2p_active' };
    try {
      const res = await fetch(`${baseUrl}/api/robot/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(servos),
      });
      if (!res.ok) return { status: 'offline' };
      return res.json();
    } catch {
      return { status: 'offline' };
    }
  }

  public static async getHistory(): Promise<any[]> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return [];
    try {
      const res = await fetch(`${baseUrl}/api/robot/history`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  }

  public static async clearHistory(): Promise<void> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return;
    try {
      await fetch(`${baseUrl}/api/robot/history/clear`, { method: 'POST' });
    } catch {}
  }
}
