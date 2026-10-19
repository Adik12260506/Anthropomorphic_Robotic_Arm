import type { SignalingMessage } from '../types/webrtc';

export interface CloudSignalingCallbacks {
  onMessage: (msg: SignalingMessage) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'failed') => void;
  onError: (err: string) => void;
}

/**
 * Universal Zero-Config Cloud Signaling Channel over Secure WebSocket MQTT Broker.
 * Provides 24/7 global room-based signaling across any network without requiring a local server.
 */
export class CloudSignalingChannel {
  private ws: WebSocket | null = null;
  private roomId: string = '';
  private isHost: boolean = false;
  private callbacks: CloudSignalingCallbacks;
  private pingInterval: any = null;
  private announceInterval: any = null;
  private isConnected: boolean = false;

  public get isReady(): boolean {
    return this.isConnected;
  }

  private readonly primaryEndpoint = 'wss://broker.hivemq.com:8884/mqtt';
  private readonly fallbackEndpoint = 'wss://broker.emqx.io:8084/mqtt';

  constructor(callbacks: CloudSignalingCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(roomId: string, isHost: boolean): void {
    this.roomId = roomId.toUpperCase();
    this.isHost = isHost;
    this.connectWithEndpoint(this.primaryEndpoint);
  }

  private connectWithEndpoint(endpoint: string): void {
    this.callbacks.onStatusChange('connecting');

    try {
      this.ws = new WebSocket(endpoint, ['mqtt']);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        // Send MQTT CONNECT packet
        const clientId = `robot-${this.roomId}-${this.isHost ? 'host' : 'peer'}-${Math.floor(Math.random() * 100000)}`;
        const connectPacket = this.encodeConnect(clientId);
        this.ws?.send(connectPacket as any);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const bytes = new Uint8Array(event.data);
        const packetType = bytes[0] & 0xf0;

        // 0x20 = CONNACK
        if (packetType === 0x20) {
          this.isConnected = true;
          this.callbacks.onStatusChange('connected');

          // Subscribe to our inbox topic
          const inboxTopic = `robot-arm-v2/${this.roomId}/${this.isHost ? 'host' : 'peer'}`;
          this.ws?.send(this.encodeSubscribe(inboxTopic) as any);

          // Start MQTT PINGREQ keep-alive (every 25 seconds)
          this.startKeepAlive();

          // Peer announces presence to host, and repeats every 3s until connected
          if (!this.isHost) {
            this.send({
              type: 'join',
              room_id: this.roomId,
            });
            this.startPeerAnnounce();
          } else {
            // Host announces presence
            this.send({
              type: 'host_ready',
              room_id: this.roomId,
              peer_count: 1,
            });
          }
          return;
        }

        // 0x90 = SUBACK
        if (packetType === 0x90) {
          // Send another announcement after subscription confirms
          if (!this.isHost) {
            this.send({ type: 'join', room_id: this.roomId });
          } else {
            this.send({ type: 'host_ready', room_id: this.roomId, peer_count: 1 });
          }
          return;
        }

        // 0x30 = PUBLISH (incoming message)
        if (packetType === 0x30) {
          const payload = this.decodePublish(bytes);
          if (payload) {
            try {
              const msg: SignalingMessage = JSON.parse(payload);
              this.callbacks.onMessage(msg);
            } catch (err) {
              console.warn('Cloud signaling JSON parse error:', err);
            }
          }
        }
      };

      this.ws.onerror = (err) => {
        console.warn(`Cloud signaling broker error (${endpoint}):`, err);
        if (endpoint === this.primaryEndpoint) {
          console.log('Switching to fallback cloud signaling broker...');
          this.connectWithEndpoint(this.fallbackEndpoint);
        } else {
          this.callbacks.onError('Could not reach cloud signaling network.');
          this.callbacks.onStatusChange('failed');
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopKeepAlive();
        this.callbacks.onStatusChange('disconnected');
      };
    } catch (err: any) {
      console.error('Cloud signaling initialization failed:', err);
      this.callbacks.onError(err?.message || 'WebSocket initialization failed');
      this.callbacks.onStatusChange('failed');
    }
  }

  public send(msg: SignalingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    // Outbox topic is the opposite peer's inbox
    const outboxTopic = `robot-arm-v2/${this.roomId}/${this.isHost ? 'peer' : 'host'}`;
    const payload = JSON.stringify(msg);
    const publishPacket = this.encodePublish(outboxTopic, payload);
    this.ws.send(publishPacket as any);
  }

  public startPeerAnnounce(): void {
    this.stopPeerAnnounce();
    this.announceInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isHost) {
        this.send({ type: 'join', room_id: this.roomId });
      }
    }, 2500);
  }

  public stopPeerAnnounce(): void {
    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }
  }

  public disconnect(): void {
    this.stopKeepAlive();
    this.stopPeerAnnounce();
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.send({ type: 'leave', room_id: this.roomId });
        }
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // MQTT PINGREQ packet: 0xc0, 0x00
        this.ws.send(new Uint8Array([0xc0, 0x00]) as any);
      }
    }, 25000);
  }

  private stopKeepAlive(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // --- MQTT 3.1.1 Binary Encoders & Decoders ---

  private encodeConnect(clientId: string): Uint8Array {
    const encoder = new TextEncoder();
    const cid = encoder.encode(clientId);
    // Variable header for MQTT 3.1.1 (Protocol: MQTT, Level: 4, Flags: CleanSession, KeepAlive: 60s)
    const varHeader = new Uint8Array([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c, 0x00, cid.length]);
    const remLen = varHeader.length + cid.length;
    const packet = new Uint8Array(2 + remLen);
    packet[0] = 0x10; // CONNECT
    packet[1] = remLen;
    packet.set(varHeader, 2);
    packet.set(cid, 2 + varHeader.length);
    return packet;
  }

  private encodeSubscribe(topic: string, packetId: number = 1): Uint8Array {
    const encoder = new TextEncoder();
    const top = encoder.encode(topic);
    const varHeader = new Uint8Array([packetId >> 8, packetId & 0xff, 0x00, top.length]);
    const remLen = varHeader.length + top.length + 1;
    const packet = new Uint8Array(2 + remLen);
    packet[0] = 0x82; // SUBSCRIBE (QoS 1)
    packet[1] = remLen;
    packet.set(varHeader, 2);
    packet.set(top, 2 + varHeader.length);
    packet[packet.length - 1] = 0x00; // Requested QoS: 0
    return packet;
  }

  private encodePublish(topic: string, payload: string): Uint8Array {
    const encoder = new TextEncoder();
    const top = encoder.encode(topic);
    const pay = encoder.encode(payload);
    const varHeader = new Uint8Array([0x00, top.length]);
    const remLen = varHeader.length + top.length + pay.length;

    // Encode MQTT variable-length integer
    const remBytes: number[] = [];
    let rem = remLen;
    do {
      let digit = rem % 128;
      rem = Math.floor(rem / 128);
      if (rem > 0) digit |= 0x80;
      remBytes.push(digit);
    } while (rem > 0);

    const packet = new Uint8Array(1 + remBytes.length + remLen);
    packet[0] = 0x30; // PUBLISH (QoS 0)
    packet.set(remBytes, 1);
    let offset = 1 + remBytes.length;
    packet.set(varHeader, offset);
    offset += varHeader.length;
    packet.set(top, offset);
    offset += top.length;
    packet.set(pay, offset);
    return packet;
  }

  private decodePublish(bytes: Uint8Array): string | null {
    if ((bytes[0] & 0xf0) !== 0x30) return null;
    const qos = (bytes[0] >> 1) & 0x03;
    let idx = 1;
    let multiplier = 1;
    let remLen = 0;
    while (idx < bytes.length) {
      const b = bytes[idx++];
      remLen += (b & 0x7f) * multiplier;
      multiplier *= 128;
      if ((b & 0x80) === 0) break;
    }
    if (idx + 2 > bytes.length) return null;
    const topicLen = (bytes[idx] << 8) | bytes[idx + 1];
    idx += 2 + topicLen;
    if (qos > 0) {
      idx += 2; // skip Packet Identifier
    }
    const payloadLen = remLen - (topicLen + 2 + (qos > 0 ? 2 : 0));
    if (idx + payloadLen > bytes.length) return null;
    const decoder = new TextDecoder();
    return decoder.decode(bytes.subarray(idx, idx + payloadLen));
  }
}
