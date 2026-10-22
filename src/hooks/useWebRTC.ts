import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

export interface UseWebRTCOptions {
  socket: Socket | null;
  roomId: string | null;
  isHost: boolean;
  isOpponentConnected: boolean;
  remoteAudioMuted?: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useWebRTC({
  socket,
  roomId,
  isHost,
  isOpponentConnected,
  remoteAudioMuted = false,
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isMicActive, setIsMicActive] = useState(true);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [mediaError, setMediaError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // 1. Initialize Local Media Stream
  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        setMediaError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (err: any) {
        console.warn('Webcam/Mic access denied or unavailable:', err);
        if (active) {
          setMediaError(
            err.name === 'NotAllowedError'
              ? 'Camera/Mic permission denied. You can still play with manual tap controls!'
              : 'Camera not detected. Using simulated video mode.'
          );
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

  // 2. Control Remote Audio Muting based on Game Phase (Secret Delivery vs Banter)
  useEffect(() => {
    if (remoteStream) {
      remoteStream.getAudioTracks().forEach((track) => {
        track.enabled = !remoteAudioMuted;
      });
    }
  }, [remoteAudioMuted, remoteStream]);

  // 3. Create or Reset PeerConnection
  const createPeerConnection = useCallback(() => {
    if (!socket || !roomId) return null;

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Attach local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        const inboundStream = new MediaStream([event.track]);
        setRemoteStream(inboundStream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && roomId) {
        socket.emit('ice_candidate', {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    return pc;
  }, [socket, roomId]);

  // 4. WebRTC Signaling Listeners
  useEffect(() => {
    if (!socket || !roomId) return;

    const handlePeerReady = async () => {
      // If we are host, initiate the offer
      if (isHost) {
        const pc = createPeerConnection();
        if (!pc) return;

        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);

          socket.emit('offer', {
            roomId,
            offer,
          });
        } catch (err) {
          console.error('Failed to create WebRTC offer:', err);
        }
      }
    };

    const handleOffer = async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      // Non-host or receiver handles offer
      let pc = pcRef.current;
      if (!pc) {
        pc = createPeerConnection();
      }
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Flush any buffered ICE candidates
        while (pendingCandidatesRef.current.length > 0) {
          const cand = pendingCandidatesRef.current.shift();
          if (cand) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer', {
          roomId,
          answer,
        });
      } catch (err) {
        console.error('Failed to handle WebRTC offer:', err);
      }
    };

    const handleAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        // Flush any buffered candidates
        while (pendingCandidatesRef.current.length > 0) {
          const cand = pendingCandidatesRef.current.shift();
          if (cand) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }
      } catch (err) {
        console.error('Failed to handle WebRTC answer:', err);
      }
    };

    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Failed to add received ICE candidate:', err);
      }
    };

    socket.on('peer_ready', handlePeerReady);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice_candidate', handleIceCandidate);

    // If opponent is already connected and local stream is ready, broadcast readiness
    if (isOpponentConnected && localStreamRef.current) {
      socket.emit('peer_ready', { roomId });
    }

    return () => {
      socket.off('peer_ready', handlePeerReady);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice_candidate', handleIceCandidate);
    };
  }, [socket, roomId, isHost, isOpponentConnected, createPeerConnection]);

  // Toggle Video Track
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraActive(videoTrack.enabled);
      }
    }
  }, []);

  // Toggle Audio Track
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicActive(audioTrack.enabled);
      }
    }
  }, []);

  return {
    localStream,
    remoteStream,
    isCameraActive,
    isMicActive,
    connectionState,
    mediaError,
    toggleCamera,
    toggleMic,
  };
}
