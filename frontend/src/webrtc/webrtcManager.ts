/**
 * WebRTC PeerConnection and Signaling Manager for Two-Phone Video Calling.
 * Hybrid signaling: Universal zero-config Cloud Signaling (MQTT WSS) for global internet connectivity,
 * with fallback to local WebSocket signaling when running locally on LAN.
 * Includes P2P RTCDataChannel for real-time zero-latency robot command telemetry sync.
 */

import type { SignalingMessage, WebRTCConnectionStatus } from '../types/webrtc';
import { CloudSignalingChannel } from './cloudSignaling';

export interface WebRTCCallbacks {
  onStatusChange: (status: WebRTCConnectionStatus) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onPeerCountChange: (count: number) => void;
  onError: (error: string) => void;
  onRemoteCommand?: (command: any) => void;
  onTelemetryReady?: (ready: boolean) => void;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingSocket: WebSocket | null = null;
  private cloudSignaling: CloudSignalingChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private roomId: string = '';
  private isInitiator: boolean = false;
  private callbacks: WebRTCCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isConnectedToSignaling: boolean = false;

  public get isSignalingConnected(): boolean {
    return this.isConnectedToSignaling;
  }

  private readonly iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'stun:stun.services.mozilla.com' },
    ],
    iceCandidatePoolSize: 10,
  };

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  public async startCall(
    roomId: string,
    signalingBaseUrl: string,
    localStream?: MediaStream | null,
    isInitiator?: boolean
  ): Promise<void> {
    this.roomId = roomId.toUpperCase();
    this.localStream = localStream || null;
    this.isInitiator = !!isInitiator;
    this.pendingCandidates = [];

    this.callbacks.onStatusChange('connecting');

    try {
      this.initPeerConnection();
      await this.initSignaling(signalingBaseUrl);
    } catch (err: any) {
      console.error('WebRTC StartCall error:', err);
      this.callbacks.onError(err?.message || 'Failed to start WebRTC session');
      this.callbacks.onStatusChange('failed');
    }
  }

  public addLocalStream(stream: MediaStream): void {
    this.localStream = stream;
    if (!this.peerConnection) return;

    for (const track of stream.getTracks()) {
      const senders = this.peerConnection.getSenders();
      const existingSender = senders.find(
        (s) => s.track?.kind === track.kind || (!s.track && track.kind === 'video')
      );
      if (existingSender) {
        existingSender.replaceTrack(track).catch(console.error);
      } else {
        const sender = this.peerConnection.addTrack(track, stream);
        if (track.kind === 'video' && sender) {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 1200000;
            params.degradationPreference = 'maintain-framerate';
            sender.setParameters(params).catch(() => {});
          } catch {}
        }
      }
    }

    // Renegotiate if connected as initiator
    if (this.isInitiator && this.peerConnection.remoteDescription) {
      this.createOffer();
    }
  }

  public sendTelemetry(command: any): void {
    const payload = JSON.stringify(command);
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(payload);
        return;
      } catch (err) {
        console.warn('DataChannel send failed, falling back to signaling:', err);
      }
    }

    this.sendSignalingMessage({
      type: 'telemetry',
      room_id: this.roomId,
      command,
    });
  }

  private initPeerConnection(): void {
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
    }

    this.peerConnection = new RTCPeerConnection(this.iceServers);
    this.remoteStream = new MediaStream();
    this.callbacks.onRemoteStream(this.remoteStream);

    // Setup DataChannel for 0ms latency robot telemetry
    if (this.isInitiator) {
      try {
        const dc = this.peerConnection.createDataChannel('robot-telemetry', { ordered: true });
        this.setupDataChannel(dc);
      } catch (err) {
        console.warn('Failed to create RTCDataChannel:', err);
      }
    } else {
      this.peerConnection.ondatachannel = (event) => {
        console.log('WebRTC: RTCDataChannel received from initiator:', event.channel.label);
        this.setupDataChannel(event.channel);
      };
    }

    // Add bidirectional transceivers so peer can receive video/audio even before local camera starts
    try {
      this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
      this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    } catch {}

    // Add local tracks to peer connection with optimized framerate preference
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        const sender = this.peerConnection.addTrack(track, this.localStream);
        if (track.kind === 'video' && sender) {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 1200000; // 1.2 Mbps for smooth 480p/720p
            params.degradationPreference = 'maintain-framerate';
            sender.setParameters(params).catch(() => {});
          } catch {}
        }
      }
    }

    // Handle incoming remote tracks smoothly
    this.peerConnection.ontrack = (event) => {
      console.log('WebRTC: Remote track received:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.callbacks.onRemoteStream(event.streams[0]);
        this.callbacks.onStatusChange('connected');
        this.callbacks.onPeerCountChange(2);
      } else if (this.remoteStream) {
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
        this.callbacks.onRemoteStream(this.remoteStream);
        this.callbacks.onStatusChange('connected');
        this.callbacks.onPeerCountChange(2);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'candidate',
          candidate: event.candidate.toJSON(),
          room_id: this.roomId,
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('WebRTC Connection state:', state);
      if (state === 'connected') {
        this.cloudSignaling?.stopPeerAnnounce();
        this.callbacks.onPeerCountChange(2);
        this.callbacks.onStatusChange('connected');
      } else if (state === 'disconnected' || state === 'closed') {
        this.callbacks.onStatusChange('disconnected');
      } else if (state === 'failed') {
        this.callbacks.onStatusChange('failed');
      }
    };
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;
    this.dataChannel.onopen = () => {
      console.log('WebRTC RTCDataChannel (robot-telemetry) is OPEN');
      this.callbacks.onTelemetryReady?.(true);
    };
    this.dataChannel.onclose = () => {
      console.log('WebRTC RTCDataChannel closed');
      this.callbacks.onTelemetryReady?.(false);
    };
    this.dataChannel.onmessage = (event) => {
      try {
        const cmd = JSON.parse(event.data);
        this.callbacks.onRemoteCommand?.(cmd);
      } catch (err) {
        console.warn('Error parsing DataChannel command:', err);
      }
    };
  }

  private async initSignaling(signalingBaseUrl: string): Promise<void> {
    const isPublicHost =
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      !/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);

    // On public domains (like Vercel) or when no local backend is present,
    // use universal Cloud Signaling over secure WebSocket broker.
    if (isPublicHost || !signalingBaseUrl || signalingBaseUrl.includes('vercel.app')) {
      console.log('Using universal Cloud Signaling for room:', this.roomId);
      this.connectCloudSignaling();
      return;
    }

    // On localhost or local Wi-Fi, attempt local signaling first with automatic fallback
    try {
      await this.connectLocalSignaling(signalingBaseUrl);
    } catch {
      console.log('Local signaling unavailable, switching to Cloud Signaling...');
      this.connectCloudSignaling();
    }
  }

  private connectCloudSignaling(): void {
    this.cloudSignaling = new CloudSignalingChannel({
      onMessage: async (msg) => {
        await this.handleSignalingMessage(msg);
      },
      onStatusChange: (status) => {
        if (status === 'connected') {
          this.isConnectedToSignaling = true;
          this.callbacks.onStatusChange('waiting_for_peer');
        } else if (status === 'failed') {
          this.callbacks.onError('Cloud signaling unavailable.');
          this.callbacks.onStatusChange('failed');
        }
      },
      onError: (err) => {
        console.warn('Cloud signaling error:', err);
      },
    });

    this.cloudSignaling.connect(this.roomId, this.isInitiator);
  }

  private connectLocalSignaling(signalingBaseUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${signalingBaseUrl.replace(/^http/, 'ws')}/${this.roomId}`;
      console.log('Connecting to local signaling at:', wsUrl);

      const ws = new WebSocket(wsUrl);
      this.signalingSocket = ws;

      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          try { ws.close(); } catch {}
          reject(new Error('Signaling connection timeout'));
        }
      }, 2500);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.isConnectedToSignaling = true;
        console.log('Local signaling connected');
        ws.send(JSON.stringify({ type: 'join', room_id: this.roomId }));
        resolve();
      };

      ws.onmessage = async (event) => {
        try {
          const msg: SignalingMessage = JSON.parse(event.data);
          await this.handleSignalingMessage(msg);
        } catch (err) {
          console.error('Error handling local signaling message:', err);
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        console.warn('Local signaling socket error:', err);
        reject(err);
      };

      ws.onclose = () => {
        this.isConnectedToSignaling = false;
      };
    });
  }

  private sendSignalingMessage(msg: SignalingMessage): void {
    if (this.cloudSignaling) {
      this.cloudSignaling.send(msg);
      return;
    }

    if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify(msg));
    }
  }

  private async handleSignalingMessage(msg: SignalingMessage): Promise<void> {
    switch (msg.type) {
      case 'host_ready':
        console.log('Host is ready in room:', msg.room_id);
        if (!this.isInitiator) {
          this.callbacks.onPeerCountChange(2);
          this.sendSignalingMessage({
            type: 'join',
            room_id: this.roomId,
          });
        }
        break;

      case 'join':
        console.log('Peer announced join to room:', msg.room_id);
        this.callbacks.onPeerCountChange(2);
        if (this.isInitiator) {
          await this.createOffer();
        }
        break;

      case 'room_state':
        if (msg.peer_count !== undefined) {
          this.callbacks.onPeerCountChange(msg.peer_count);
          if (msg.peer_count === 1) {
            this.callbacks.onStatusChange('waiting_for_peer');
          } else if (msg.peer_count >= 2) {
            if (this.isInitiator) {
              await this.createOffer();
            } else {
              this.sendSignalingMessage({ type: 'join', room_id: this.roomId });
            }
          }
        }
        break;

      case 'offer':
        if (!this.isInitiator && msg.sdp) {
          await this.handleOffer(msg.sdp);
        }
        break;

      case 'answer':
        if (this.isInitiator && msg.sdp && this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          this.processPendingCandidates();
        }
        break;

      case 'candidate':
        if (msg.candidate) {
          try {
            if (this.peerConnection?.remoteDescription && this.peerConnection.remoteDescription.type) {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } else {
              this.pendingCandidates.push(msg.candidate);
            }
          } catch (e) {
            console.warn('Error buffering/adding ICE candidate:', e);
          }
        }
        break;

      case 'telemetry':
        if (msg.command) {
          this.callbacks.onRemoteCommand?.(msg.command);
        }
        break;

      case 'leave':
        this.callbacks.onStatusChange('waiting_for_peer');
        this.callbacks.onPeerCountChange(1);
        break;
    }
  }

  private async createOffer(): Promise<void> {
    if (!this.peerConnection) return;
    try {
      console.log('Creating WebRTC offer for room:', this.roomId);
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: 'offer',
        sdp: offer,
        room_id: this.roomId,
      });
    } catch (err: any) {
      console.error('Failed to create WebRTC offer:', err);
      this.callbacks.onError('Failed to create WebRTC offer');
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    try {
      console.log('Handling WebRTC offer and creating answer for room:', this.roomId);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      this.processPendingCandidates();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.sendSignalingMessage({
        type: 'answer',
        sdp: answer,
        room_id: this.roomId,
      });
    } catch (err: any) {
      console.error('Failed to handle WebRTC offer:', err);
      this.callbacks.onError('Failed to handle WebRTC offer');
    }
  }

  private processPendingCandidates(): void {
    if (!this.peerConnection) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      }
    }
  }

  public endCall(): void {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }

    if (this.cloudSignaling) {
      this.cloudSignaling.disconnect();
      this.cloudSignaling = null;
    }

    if (this.signalingSocket) {
      if (this.signalingSocket.readyState === WebSocket.OPEN) {
        this.signalingSocket.send(JSON.stringify({ type: 'leave', room_id: this.roomId }));
      }
      try {
        this.signalingSocket.close();
      } catch {}
      this.signalingSocket = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    this.callbacks.onStatusChange('disconnected');
    this.callbacks.onPeerCountChange(0);
  }
}
