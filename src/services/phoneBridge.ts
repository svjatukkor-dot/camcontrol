import { PhoneRemoteCommand } from '../types/camera';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface CreatedPairingRoom {
  code: string;
  hostToken: string;
  expiresAt: number;
}

interface SignalEnvelope {
  type: 'offer' | 'answer' | 'ice' | 'control';
  payload: unknown;
}

export async function createPhoneBridgeRoom(): Promise<CreatedPairingRoom> {
  const response = await fetch('/api/phone-bridge/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.error ||
        'Сервер сполучення недоступний у поточному автономному режимі.'
    );
  }
  return (await response.json()) as CreatedPairingRoom;
}

export class HostPhoneReceiver {
  private readonly code: string;
  private readonly hostToken: string;
  private eventSource: EventSource | null = null;
  private pc: RTCPeerConnection | null = null;
  private phoneName = 'Смартфон (Wi-Fi WebRTC)';
  private readonly onStream: (stream: MediaStream, phoneName: string) => void;
  private readonly onStatus: (
    status: 'waiting' | 'connecting' | 'connected' | 'disconnected',
    detail: string
  ) => void;

  constructor(
    code: string,
    hostToken: string,
    handlers: {
      onStream: (stream: MediaStream, phoneName: string) => void;
      onStatus: (
        status: 'waiting' | 'connecting' | 'connected' | 'disconnected',
        detail: string
      ) => void;
    }
  ) {
    this.code = code;
    this.hostToken = hostToken;
    this.onStream = handlers.onStream;
    this.onStatus = handlers.onStatus;
  }

  start(): void {
    this.onStatus('waiting', 'Очікування підключення смартфона…');
    const url = `/api/phone-bridge/rooms/${encodeURIComponent(
      this.code
    )}/events?role=host&token=${encodeURIComponent(this.hostToken)}`;
    const es = new EventSource(url);
    this.eventSource = es;

    es.addEventListener('phone-joined', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        if (typeof data.phoneName === 'string') {
          this.phoneName = data.phoneName;
        }
      } catch {
        // ignore parse errors
      }
      this.onStatus(
        'connecting',
        `Смартфон "${this.phoneName}" приєднався, встановлення відеопотоку…`
      );
    });

    es.addEventListener('signal', (ev) => {
      try {
        const msg = JSON.parse((ev as MessageEvent).data) as SignalEnvelope;
        void this.handleSignal(msg);
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener('peer-disconnected', () => {
      this.closePeer();
      this.onStatus('disconnected', 'Смартфон завершив трансляцію.');
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        this.onStatus('disconnected', 'Канал сполучення закрито.');
      }
    };
  }

  async sendRemoteCommand(command: PhoneRemoteCommand): Promise<void> {
    await this.sendSignal('control', command);
  }

  private ensurePeerConnection(): RTCPeerConnection {
    if (this.pc) return this.pc;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remoteStream = new MediaStream();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignal('ice', event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      const incoming = event.streams[0];
      if (incoming) {
        for (const t of incoming.getTracks()) {
          if (!remoteStream.getTracks().some((existing) => existing.id === t.id)) {
            remoteStream.addTrack(t);
          }
        }
      } else {
        remoteStream.addTrack(event.track);
      }

      if (remoteStream.getVideoTracks().length > 0) {
        this.onStatus('connected', `Отримано відеопотік: ${this.phoneName}`);
        this.onStream(remoteStream, this.phoneName);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.onStatus('disconnected', 'Зв’язок зі смартфоном перервано.');
      }
    };

    this.pc = pc;
    return pc;
  }

  private async handleSignal(msg: SignalEnvelope): Promise<void> {
    if (msg.type === 'offer') {
      this.closePeer();
      const pc = this.ensurePeerConnection();
      const offer = msg.payload as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal('answer', answer);
    } else if (msg.type === 'ice' && this.pc) {
      const candidate = msg.payload as RTCIceCandidateInit;
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
  }

  private async sendSignal(
    type: 'offer' | 'answer' | 'ice' | 'control',
    payload: unknown
  ): Promise<void> {
    await fetch(`/api/phone-bridge/rooms/${encodeURIComponent(this.code)}/signal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.hostToken}`,
      },
      body: JSON.stringify({ role: 'host', type, payload }),
    });
  }

  private closePeer(): void {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  stop(): void {
    this.closePeer();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    void fetch(`/api/phone-bridge/rooms/${encodeURIComponent(this.code)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.hostToken}` },
    }).catch(() => {});
  }
}

export class PhoneCameraSender {
  private readonly code: string;
  private phoneToken = '';
  private eventSource: EventSource | null = null;
  private pc: RTCPeerConnection | null = null;
  private readonly onStatus: (status: string, isError?: boolean) => void;
  private readonly onRemoteCommand?: (command: PhoneRemoteCommand) => void;

  constructor(
    code: string,
    onStatus: (status: string, isError?: boolean) => void,
    onRemoteCommand?: (command: PhoneRemoteCommand) => void
  ) {
    this.code = code.toUpperCase().trim();
    this.onStatus = onStatus;
    this.onRemoteCommand = onRemoteCommand;
  }

  async connect(stream: MediaStream, deviceName: string): Promise<void> {
    this.onStatus('Підключення до ПК…');
    const joinRes = await fetch(
      `/api/phone-bridge/rooms/${encodeURIComponent(this.code)}/join`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName }),
      }
    );

    if (!joinRes.ok) {
      const errBody = await joinRes.json().catch(() => ({}));
      throw new Error(errBody.error || 'Не вдалося приєднатися за цим кодом.');
    }

    const joined = (await joinRes.json()) as { phoneToken: string };
    this.phoneToken = joined.phoneToken;

    const esUrl = `/api/phone-bridge/rooms/${encodeURIComponent(
      this.code
    )}/events?role=phone&token=${encodeURIComponent(this.phoneToken)}`;
    const es = new EventSource(esUrl);
    this.eventSource = es;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignal('ice', event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.onStatus('Трансляція на ПК активна');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.onStatus('З’єднання з ПК перервано', true);
      }
    };

    es.addEventListener('signal', (ev) => {
      try {
        const msg = JSON.parse((ev as MessageEvent).data) as SignalEnvelope;
        if (msg.type === 'answer') {
          void pc.setRemoteDescription(
            new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit)
          );
        } else if (msg.type === 'ice') {
          void pc
            .addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit))
            .catch(() => {});
        } else if (msg.type === 'control' && msg.payload) {
          this.onRemoteCommand?.(msg.payload as PhoneRemoteCommand);
        }
      } catch {
        // ignore malformed event
      }
    });

    es.addEventListener('peer-disconnected', () => {
      this.onStatus('ПК закрив сесію прийому камери', true);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.sendSignal('offer', offer);
    this.onStatus('Надсилання відеопотоку на ПК…');
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.pc) return;
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  async setAudioTrack(audioTrack: MediaStreamTrack | null): Promise<void> {
    if (!this.pc) return;
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'audio');
    if (sender) {
      await sender.replaceTrack(audioTrack);
    }
  }

  private async sendSignal(type: 'offer' | 'answer' | 'ice', payload: unknown): Promise<void> {
    await fetch(`/api/phone-bridge/rooms/${encodeURIComponent(this.code)}/signal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.phoneToken}`,
      },
      body: JSON.stringify({ role: 'phone', type, payload }),
    });
  }

  stop(): void {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
