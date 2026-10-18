/**
 * WebRTC PeerConnection and Signaling Manager for Two-Phone Video Calling.
 */

import type { SignalingMessage, WebRTCConnectionStatus } from '../types/webrtc';

export interface WebRTCCallbacks {
  onStatusChange: (status: WebRTCConnectionStatus) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onPeerCountChange: (count: number) => void;
  onError: (error: string) => void;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private signalingSocket: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private roomId: string = '';
  private isInitiator: boolean = false;
  private callbacks: WebRTCCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private readonly iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
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
    this.roomId = roomId;
    this.localStream = localStream || null;
    this.isInitiator = !!isInitiator;

    this.callbacks.onStatusChange('connecting');

    try {
      this.initPeerConnection();
      await this.connectSignaling(signalingBaseUrl);
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

  private initPeerConnection(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection(this.iceServers);
    this.remoteStream = new MediaStream();
    this.callbacks.onRemoteStream(this.remoteStream);

    // Add bidirectional transceivers so peer can receive video/audio even before local camera starts
    try {
      this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
      this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    } catch {
      // Older webviews support standard addTrack fallback
    }

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
            params.encodings[0].maxBitrate = 1200000; // 1.2 Mbps for smooth, low-latency 480p/720p
            params.degradationPreference = 'maintain-framerate'; // Prioritize high FPS over high res to stop stuttering
            sender.setParameters(params).catch(() => {});
          } catch {
            // Browser might not allow immediate setParameters before negotiation
          }
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
      } else if (this.remoteStream) {
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
        this.callbacks.onRemoteStream(this.remoteStream);
        this.callbacks.onStatusChange('connected');
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingSocket?.readyState === WebSocket.OPEN) {
        this.signalingSocket.send(
          JSON.stringify({
            type: 'candidate',
            candidate: event.candidate.toJSON(),
            room_id: this.roomId,
          })
        );
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('WebRTC Connection state:', state);
      if (state === 'connected') {
        this.callbacks.onStatusChange('connected');
      } else if (state === 'disconnected' || state === 'closed') {
        this.callbacks.onStatusChange('disconnected');
      } else if (state === 'failed') {
        this.callbacks.onStatusChange('failed');
      }
    };
  }

  private async connectSignaling(signalingBaseUrl: string): Promise<void> {
    const wsUrl = `${signalingBaseUrl.replace(/^http/, 'ws')}/${this.roomId}`;
    console.log('Connecting to WebRTC signaling at:', wsUrl);

    this.signalingSocket = new WebSocket(wsUrl);

    this.signalingSocket.onopen = () => {
      console.log('Signaling WebSocket connected');
      this.signalingSocket?.send(
        JSON.stringify({
          type: 'join',
          room_id: this.roomId,
        })
      );
    };

    this.signalingSocket.onmessage = async (event) => {
      try {
        const msg: SignalingMessage = JSON.parse(event.data);
        await this.handleSignalingMessage(msg);
      } catch (err) {
        console.error('Error handling signaling message:', err);
      }
    };

    this.signalingSocket.onerror = (err) => {
      console.warn('Signaling WebSocket error:', err);
      this.callbacks.onStatusChange('failed');
      this.callbacks.onError('Signaling connection failed. Ensure backend server is running on the Wi-Fi host.');
    };

    this.signalingSocket.onclose = () => {
      console.log('Signaling WebSocket closed');
    };
  }

  private async handleSignalingMessage(msg: SignalingMessage): Promise<void> {
    switch (msg.type) {
      case 'room_state':
        if (msg.peer_count !== undefined) {
          this.callbacks.onPeerCountChange(msg.peer_count);
          if (msg.peer_count === 1) {
            this.callbacks.onStatusChange('waiting_for_peer');
          } else if (msg.peer_count >= 2 && this.isInitiator) {
            // Second peer joined, initiator creates offer
            await this.createOffer();
          }
        }
        break;

      case 'join':
        console.log('Peer announced join to room:', msg.room_id);
        if (this.isInitiator) {
          await this.createOffer();
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
          await this.processPendingCandidates();
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

      case 'leave':
        this.callbacks.onStatusChange('waiting_for_peer');
        break;
    }
  }

  private async createOffer(): Promise<void> {
    if (!this.peerConnection) return;
    try {
      console.log('Creating WebRTC offer...');
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.signalingSocket?.send(
        JSON.stringify({
          type: 'offer',
          sdp: offer,
          room_id: this.roomId,
        })
      );
    } catch (err: any) {
      console.error('Failed to create WebRTC offer:', err);
      this.callbacks.onError('Failed to create WebRTC offer');
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    try {
      console.log('Handling WebRTC offer and creating answer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      this.processPendingCandidates();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.signalingSocket?.send(
        JSON.stringify({
          type: 'answer',
          sdp: answer,
          room_id: this.roomId,
        })
      );
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
    if (this.signalingSocket) {
      if (this.signalingSocket.readyState === WebSocket.OPEN) {
        this.signalingSocket.send(JSON.stringify({ type: 'leave', room_id: this.roomId }));
      }
      this.signalingSocket.close();
      this.signalingSocket = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.callbacks.onStatusChange('disconnected');
  }
}
