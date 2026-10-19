/**
 * WebRTC Signaling and Peer Connection Types
 */

export type SignalingMessageType =
  | 'join'
  | 'host_ready'
  | 'room_state'
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'telemetry'
  | 'leave'
  | 'error';

export interface SignalingMessage {
  type: SignalingMessageType;
  room_id?: string;
  peer_count?: number;
  message?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  command?: any;
  sender_id?: string;
  timestamp?: number;
}

export type WebRTCConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'waiting_for_peer'
  | 'failed';

export interface RoomState {
  roomId: string;
  isConnected: boolean;
  peerCount: number;
  isHost: boolean;
}
