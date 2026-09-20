// src/utils/webrtc.ts
export interface PeerConnectionConfig {
  onRemoteStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private config: PeerConnectionConfig | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  init(config: PeerConnectionConfig) {
    this.cleanup();
    this.config = config;
    this.pendingCandidates = [];
    this.pc = new RTCPeerConnection(ICE_SERVERS);

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.config) {
        this.config.onIceCandidate(event.candidate.toJSON());
      }
    };

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0] && this.config) {
        this.config.onRemoteStream(event.streams[0]);
      } else if (event.track && this.config) {
        const newStream = new MediaStream([event.track]);
        this.config.onRemoteStream(newStream);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc && this.config?.onConnectionStateChange) {
        this.config.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc && this.config?.onConnectionStateChange) {
        const iceState = this.pc.iceConnectionState;
        if (iceState === 'connected' || iceState === 'completed') {
          this.config.onConnectionStateChange('connected');
        } else if (iceState === 'disconnected' || iceState === 'failed') {
          this.config.onConnectionStateChange('failed');
        }
      }
    };
  }

  createSilentAudioStream(): MediaStream {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const dst = oscillator.connect(ctx.createMediaStreamDestination()) as any;
      oscillator.start();
      const track = dst.stream.getAudioTracks()[0];
      return new MediaStream([track]);
    } catch {
      return new MediaStream();
    }
  }

  async setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    stream.getTracks().forEach((track) => {
      if (this.pc) {
        const existingSender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(() => {});
        } else {
          this.pc.addTrack(track, stream);
        }
      }
    });
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.pc.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.error('WebRTC offer hatası:', err);
      return null;
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this.flushPendingCandidates();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      return answer;
    } catch (err) {
      console.error('WebRTC offer karşılama hatası:', err);
      return null;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return null;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushPendingCandidates();
    } catch (err) {
      console.error('WebRTC answer hatası:', err);
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    if (!this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('ICE adayı eklenemedi:', err);
    }
  }

  private async flushPendingCandidates() {
    if (!this.pc) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Tamponlanan ICE adayı eklenemedi:', err);
        }
      }
    }
  }

  cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.pendingCandidates = [];
    this.config = null;
  }
}

export const webrtcManager = new WebRTCManager();
