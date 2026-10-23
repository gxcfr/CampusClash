import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Flame,
  Shield,
  Trophy,
  ArrowRight,
  Clock,
  Sparkles,
  Users,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  Volume2,
  VolumeX,
  Share2,
  Hand,
  Bot,
  Play,
} from 'lucide-react';

import type { RoomState, BallResult, CameraMode } from '../types/game';
import { useHandDetection } from '../hooks/useHandDetection';
import { useWebRTC } from '../hooks/useWebRTC';
import { sounds } from '../utils/audio';
import { HandCricketPitchArena } from './HandCricketPitchArena';

interface HandCricketArenaProps {
  socket: Socket | any;
  username: string;
  onLeaveArena: () => void;
  initialCameraMode?: CameraMode;
}

const NUMBER_EMOJIS: Record<number, string> = {
  1: '👆',
  2: '✌️',
  3: '🤟',
  4: '🏏',
  5: '🖐️',
  6: '💥',
};

export const HandCricketArena: React.FC<HandCricketArenaProps> = ({
  socket,
  username,
  onLeaveArena,
  initialCameraMode = 'camera',
}) => {
  // Room state from server / peer
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [manualChoice, setManualChoice] = useState<number | null>(null);
  const [choiceLockedIn, setChoiceLockedIn] = useState<number | null>(null);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [selectedCameraMode, setSelectedCameraMode] = useState<CameraMode>(initialCameraMode);
  const [queueCountdown, setQueueCountdown] = useState<number>(4);

  // Active camera mode is governed by roomState if in a room, else local selection
  const activeCameraMode: CameraMode = roomState?.cameraMode || selectedCameraMode;
  const isCameraMode = activeCameraMode === 'camera';

  // Video DOM refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Derive player info
  const myPlayerId = socket?.id || '';
  const myPlayer =
    roomState?.players[myPlayerId] ||
    Object.values(roomState?.players || {}).find((p) => p.username === username);
  const isHost = Boolean(myPlayer?.isHost || (socket as any)?.isHost);

  const opponentEntry = Object.entries(roomState?.players || {}).find(
    ([id, p]) => id !== myPlayerId && p.username !== username
  );
  const opponentPlayer = opponentEntry?.[1] || null;
  const isOpponentConnected = Boolean(opponentPlayer);

  // Phase condition: Remote audio & video is blurred/muted strictly during Phase 1
  const isSecretPhase = roomState?.phase === 'PHASE_1_COUNTDOWN';

  // 1. WebRTC Hook (only initialized when camera mode is active!)
  const {
    localStream,
    remoteStream,
    isCameraActive,
    isMicActive,
    mediaError,
    toggleCamera,
    toggleMic,
  } = useWebRTC({
    socket,
    roomId: roomState?.roomId || null,
    isHost,
    isOpponentConnected,
    remoteAudioMuted: isSecretPhase,
    enabled: isCameraMode,
  });

  // Callback refs to guarantee immediate video playback whenever DOM nodes mount
  const setLocalVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      localVideoRef.current = node;
      if (node) {
        node.muted = true;
        node.setAttribute('playsinline', 'true');
        node.setAttribute('webkit-playsinline', 'true');
        if (localStream) {
          if (node.srcObject !== localStream) {
            node.srcObject = localStream;
          }
          node.play().catch(() => {});
        }
      }
    },
    [localStream]
  );

  const setRemoteVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      remoteVideoRef.current = node;
      if (node) {
        node.setAttribute('playsinline', 'true');
        node.setAttribute('webkit-playsinline', 'true');
        if (remoteStream) {
          if (node.srcObject !== remoteStream) {
            node.srcObject = remoteStream;
          }
          node.play().catch(() => {});
        }
      }
    },
    [remoteStream]
  );

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, roomState?.phase]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, roomState?.phase]);

  // 2. Client-side Edge Computer Vision (only active in camera mode!)
  const {
    isModelLoading,
    loadError,
    activeDelegate,
    detectedNumber,
    gestureLabel,
    startSampling,
    stopSampling,
  } = useHandDetection({
    videoRef: localVideoRef as React.RefObject<HTMLVideoElement>,
    canvasRef: showLandmarks ? (canvasRef as React.RefObject<HTMLCanvasElement>) : undefined,
    enabled: isCameraMode,
  });

  // Active preview number
  const currentPreviewNumber = manualChoice ?? (isCameraMode ? detectedNumber : null);

  // Queue auto-bot countdown
  useEffect(() => {
    if (roomState?.phase === 'MATCHMAKING') {
      setQueueCountdown(4);
      const interval = setInterval(() => {
        setQueueCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleStartBotMatch();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [roomState?.phase]);

  // Listen to Server / Peer Room Events
  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdate = (state: RoomState) => {
      setRoomState(state);
      setErrorMsg(null);
    };

    const handlePhaseCountdownTick = ({ seconds }: { seconds: number }) => {
      setRoomState((prev) => (prev ? { ...prev, phaseSecondsRemaining: seconds } : null));

      if (seconds > 0) {
        sounds.playTick();
      }

      if (isCameraMode && seconds === 2) {
        startSampling();
      }

      if (seconds === 0) {
        const sampledMode = isCameraMode ? stopSampling() : null;
        const finalChoice = manualChoice ?? sampledMode ?? detectedNumber ?? 6;
        setChoiceLockedIn(finalChoice);
        sounds.playLockIn();

        socket.emit('submit_choice', {
          roomId: roomState?.roomId,
          choice: finalChoice,
        });
      }
    };

    const handleBallResolved = (result: BallResult) => {
      setManualChoice(null);
      setChoiceLockedIn(null);

      if (result.isWicket) {
        sounds.playWicket();
      } else {
        sounds.playRuns(result.runsScored);
      }
    };

    const handleGameOver = () => {
      sounds.playVictory();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    };

    const handleError = ({ message }: { message: string }) => {
      setErrorMsg(message);
    };

    socket.on('room_update', handleRoomUpdate);
    socket.on('countdown_tick', handlePhaseCountdownTick);
    socket.on('ball_resolved', handleBallResolved);
    socket.on('game_over', handleGameOver);
    socket.on('game_error', handleError);

    return () => {
      socket.off('room_update', handleRoomUpdate);
      socket.off('countdown_tick', handlePhaseCountdownTick);
      socket.off('ball_resolved', handleBallResolved);
      socket.off('game_over', handleGameOver);
      socket.off('game_error', handleError);
    };
  }, [socket, roomState?.roomId, manualChoice, detectedNumber, isCameraMode, startSampling, stopSampling]);

  // Handle Matchmaking Actions
  const handleCreateParty = () => {
    if (!socket) return;
    setErrorMsg(null);
    socket.emit('create_room', {
      username,
      cameraMode: selectedCameraMode,
    });
  };

  const handleJoinParty = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!socket || !cleanCode) return;
    setErrorMsg(null);
    socket.emit('join_room', {
      roomId: cleanCode,
      username,
    });
  };

  const handleQuickMatch = () => {
    if (!socket) return;
    setErrorMsg(null);
    socket.emit('quick_match', {
      username,
      cameraMode: selectedCameraMode,
    });
  };

  const handleStartBotMatch = () => {
    if (!socket) return;
    setErrorMsg(null);
    socket.emit('start_bot_match', {
      username,
      cameraMode: selectedCameraMode,
    });
  };

  const handleStartMatch = () => {
    if (!socket || !roomState?.roomId) return;
    socket.emit('start_match', { roomId: roomState.roomId });
  };

  const handleNextBall = () => {
    if (!socket || !roomState?.roomId) return;
    socket.emit('next_ball', { roomId: roomState.roomId });
  };

  const handleRematch = () => {
    if (!socket || !roomState?.roomId) return;
    socket.emit('rematch', { roomId: roomState.roomId });
  };

  const handleCopyCode = () => {
    if (roomState?.roomId) {
      navigator.clipboard.writeText(roomState.roomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // ----------------------------------------------------
  // VIEW: MATCHMAKING & LOBBY SCREEN
  // ----------------------------------------------------
  if (!roomState || roomState.phase === 'LOBBY' || roomState.phase === 'MATCHMAKING') {
    return (
      <div className="min-h-screen bg-[#0e121a] flex flex-col text-slate-100 p-4 sm:p-6 lg:p-8">
        {/* Top Header */}
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onLeaveArena}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 transition-colors"
              title="Return to lobby"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display font-extrabold text-xl sm:text-2xl text-white">
                  HAND CRICKET 1v1
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Lobby
                </span>
              </div>
              <p className="text-xs text-zinc-400">Campus Street Cricket & Face Reveal Duel</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-300 bg-zinc-900/90 px-3.5 py-1.5 rounded-xl border border-zinc-700/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{username}</span>
          </div>
        </div>

        {/* Matchmaking Body */}
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center py-6 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Selector Pill Bar */}
          {!roomState?.roomId && (
            <div className="p-4 rounded-2xl bg-[#141926] border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div>
                <span className="text-xs font-bold text-white block">
                  Select Game Style
                </span>
                <p className="text-xs text-zinc-400">
                  Play with video reactions or instantly with interactive touch keypad.
                </p>
              </div>

              <div className="flex items-center gap-2 p-1.5 bg-zinc-900 rounded-xl border border-zinc-800">
                <button
                  onClick={() => setSelectedCameraMode('camera')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    selectedCameraMode === 'camera'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  With Camera (Vision)
                </button>
                <button
                  onClick={() => setSelectedCameraMode('no-camera')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    selectedCameraMode === 'no-camera'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Hand className="w-4 h-4" />
                  Without Camera (Classic)
                </button>
              </div>
            </div>
          )}

          {/* Camera Pre-Check (only in camera mode) */}
          {isCameraMode && !roomState?.roomId && (
            <div className="p-4 rounded-2xl bg-[#141926] border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="relative w-28 h-20 rounded-xl overflow-hidden bg-black border border-zinc-700 flex-shrink-0">
                  <video
                    ref={setLocalVideoNode}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  {!localStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-zinc-500 text-[10px] text-center p-1">
                      Waiting for camera...
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider block">
                    Camera & AI Hand Test
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xl">
                      {detectedNumber ? NUMBER_EMOJIS[detectedNumber] : '✋'}
                    </span>
                    <span className="font-mono font-bold text-white text-sm">
                      {detectedNumber ? `${detectedNumber} RUNS` : 'Show hand to camera'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono">{gestureLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {loadError ? (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Keypad Mode (AI Offline)
                  </span>
                ) : isModelLoading ? (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                    Loading Edge AI...
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    Edge CV Ready ({activeDelegate || 'WASM'})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick Match Searching Radar */}
          {roomState?.phase === 'MATCHMAKING' ? (
            <div className="p-8 rounded-3xl bg-[#141926] border border-zinc-800 shadow-xl text-center space-y-6 max-w-lg mx-auto w-full animate-fadeIn">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-50" />
                <span className="absolute inset-2 rounded-full border border-emerald-400 animate-pulse" />
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">
                  Instant Matchmaking ({isCameraMode ? 'With Camera' : 'Keypad Mode'})
                </span>
                <h3 className="mt-1 font-display text-2xl font-black text-white">
                  SEARCHING FOR 1v1 OPPONENT...
                </h3>
                <p className="mt-2 text-xs text-zinc-400 max-w-xs mx-auto">
                  Looking for another student in the queue. Auto-matching with campus bot in {queueCountdown}s!
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={handleStartBotMatch}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Bot className="w-4 h-4" />
                  Play with Campus Bot Now 🤖
                </button>

                <button
                  onClick={() => setRoomState(null)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancel Matchmaking
                </button>
              </div>
            </div>
          ) : roomState?.roomId ? (
            /* Inside Party Room / Match Ready Screen */
            <div className="p-8 rounded-3xl bg-[#141926] border border-zinc-800 shadow-xl text-center space-y-6 max-w-lg mx-auto w-full animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                <Users className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {roomState.mode === 'quick' ? 'Match Found!' : 'Room Access Code'}
                </span>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="font-display text-4xl sm:text-5xl font-black text-white tracking-widest bg-zinc-900 px-6 py-2 rounded-2xl border border-zinc-700">
                    {roomState.roomId}
                  </span>
                  {roomState.mode !== 'quick' && (
                    <button
                      onClick={handleCopyCode}
                      className="p-3 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                      title="Copy Room Code"
                    >
                      {copiedCode ? (
                        <Check className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  {roomState.mode === 'quick'
                    ? 'Opponent paired! Mode: ' + (isCameraMode ? 'With Camera' : 'Keypad Mode')
                    : 'Share this 4-character code with your friend to play!'}
                </p>
              </div>

              {/* Connected Players Status */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3 text-left">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-400">Host (Batsman):</span>
                  <span className="text-white font-mono">
                    {myPlayer?.isHost ? `${username} (You)` : opponentPlayer?.username || 'Host'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-400">Challenger (Bowler):</span>
                  {opponentPlayer ? (
                    <span className="text-emerald-400 font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      {opponentPlayer.username} (Ready!)
                    </span>
                  ) : !myPlayer?.isHost ? (
                    <span className="text-emerald-400 font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      {username} (You)
                    </span>
                  ) : (
                    <span className="text-amber-400 animate-pulse font-mono">Waiting for friend to enter code...</span>
                  )}
                </div>
              </div>

              {/* Start Match Button (Both players can launch once opponent connected) */}
              <button
                disabled={!isOpponentConnected}
                onClick={handleStartMatch}
                className={`w-full py-3.5 px-6 rounded-xl font-display font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all ${
                  isOpponentConnected
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 shadow-md hover:scale-[1.02]'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <Flame className="w-4 h-4 fill-current" />
                {isOpponentConnected ? 'START THE 1v1 DUEL' : 'WAITING FOR 2ND PLAYER'}
              </button>
            </div>
          ) : (
            /* Option A vs Option B Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Party Mode */}
              <div className="p-6 rounded-3xl bg-[#141926] border border-zinc-800 space-y-6 flex flex-col justify-between shadow-lg">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    <Share2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">Party Code Mode</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Host a private room with a 4-letter code, or enter a code from a campus friend.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleCreateParty}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Host Room (Generate Code)
                  </button>

                  <div className="relative flex items-center justify-center">
                    <div className="w-full border-t border-zinc-800" />
                    <span className="absolute px-2 bg-[#141926] text-[11px] font-bold text-zinc-500 uppercase">
                      OR ENTER CODE
                    </span>
                  </div>

                  <form onSubmit={handleJoinParty} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. NRCU"
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-center font-display font-bold tracking-widest text-white uppercase placeholder-zinc-600 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      disabled={joinCodeInput.trim().length !== 4}
                      className="px-5 rounded-xl font-bold text-xs bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
                    >
                      Join
                    </button>
                  </form>
                </div>
              </div>

              {/* Card 2: Quick Match 1v1 */}
              <div className="p-6 rounded-3xl bg-[#141926] border border-zinc-800 space-y-6 flex flex-col justify-between shadow-lg">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                    <Flame className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">Instant 1v1 Queue</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Instantly pair against another student or jump straight into a bot practice duel.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    onClick={handleQuickMatch}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Enter Instant 1v1 Queue
                  </button>

                  <button
                    onClick={handleStartBotMatch}
                    className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-zinc-300 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 transition-colors flex items-center justify-center gap-2"
                  >
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    Practice with Campus Bot 🤖
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Version v0.5 */}
        <footer className="pt-6 border-t border-zinc-800/60 max-w-4xl mx-auto w-full flex items-center justify-between text-xs text-zinc-500">
          <span>CampusClash MUJ — Hand Cricket</span>
          <span className="font-mono font-semibold">v0.5</span>
        </footer>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW: 22-YARD CRICKET PITCH ARENA
  // ----------------------------------------------------
  const amIBatsman = myPlayer?.role === 'batsman';

  const arenaPhase: 'countdown' | 'reveal' | 'banter' =
    roomState.phase === 'PHASE_1_COUNTDOWN'
      ? 'countdown'
      : roomState.phase === 'PHASE_2_REVEAL'
      ? 'reveal'
      : 'banter';

  const overString = `${Math.floor(roomState.currentBallsBowled / 6)}.${roomState.currentBallsBowled % 6}`;

  const lastBallFormatted = roomState.lastBallResult
    ? {
        runs: roomState.lastBallResult.runsScored,
        isOut: roomState.lastBallResult.isWicket,
        batChoice: roomState.lastBallResult.batsmanChoice,
        bowlChoice: roomState.lastBallResult.bowlerChoice,
      }
    : null;

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#0c1017] flex flex-col items-center justify-center">
      <div className="w-full max-w-lg h-[100dvh] relative shadow-2xl overflow-hidden flex flex-col">
        <HandCricketPitchArena
          roomCode={roomState.roomId}
          isBatting={amIBatsman}
          score={{
            runs: roomState.currentInningRuns,
            wickets: roomState.currentInningWickets,
            target: roomState.targetRuns,
            over: overString,
          }}
          localStream={isCameraMode ? localStream : null}
          remoteStream={isCameraMode ? remoteStream : null}
          detectedNumber={currentPreviewNumber}
          phase={arenaPhase}
          timer={roomState.phaseSecondsRemaining}
          lastBallResult={lastBallFormatted}
          onNextBall={handleNextBall}
          onLeave={onLeaveArena}
          onSelectManualChoice={(num) => setManualChoice(num)}
          manualChoice={manualChoice}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          canvasRef={showLandmarks && isCameraMode ? (canvasRef as React.RefObject<HTMLCanvasElement>) : undefined}
          cameraMode={activeCameraMode}
          myUsername={username || 'You'}
          opponentUsername={opponentPlayer?.username || 'Opponent'}
          isCameraActive={isCameraActive}
          isMicActive={isMicActive}
          onToggleCamera={toggleCamera}
          onToggleMic={toggleMic}
        />

        {/* Inning Transition Modal */}
        {roomState.phase === 'INNING_TRANSITION' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="p-8 rounded-3xl bg-zinc-900 border border-amber-500/60 shadow-2xl text-center space-y-4 max-w-md w-full">
              <span className="text-xs font-bold uppercase text-amber-400 tracking-wider font-mono">
                Inning 1 Complete!
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-black text-white">
                ROLES REVERSED!
              </h3>
              <p className="text-xs text-zinc-300">
                Target set to{' '}
                <span className="font-display font-bold text-amber-400 text-lg">
                  {roomState.targetRuns} runs
                </span>
                . Batsman and Bowler roles have flipped!
              </p>
              <button
                onClick={handleNextBall}
                className="w-full py-3 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 transition-all font-display tracking-wider"
              >
                Start 2nd Inning
              </button>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {roomState.phase === 'GAME_OVER' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
            <div className="p-8 rounded-3xl bg-zinc-900 border border-emerald-500/50 shadow-2xl text-center space-y-5 max-w-md w-full">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                <Trophy className="w-8 h-8" />
              </div>
              <h3 className="font-display text-3xl font-black text-white">
                {roomState.winnerId === myPlayerId
                  ? 'VICTORY! 🏆'
                  : roomState.winnerId
                  ? 'DEFEATED! 💔'
                  : 'MATCH TIED! 🤝'}
              </h3>
              <p className="text-sm text-zinc-300 font-medium">{roomState.winMessage}</p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onLeaveArena}
                  className="flex-1 py-3 rounded-xl text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Exit to Lobby
                </button>
                <button
                  onClick={handleRematch}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-md transition-all font-display tracking-wider"
                >
                  Play Rematch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
