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
  Eye,
} from 'lucide-react';

import type { RoomState, BallResult } from '../types/game';
import { useHandDetection } from '../hooks/useHandDetection';
import { useWebRTC } from '../hooks/useWebRTC';
import { sounds } from '../utils/audio';

interface HandCricketArenaProps {
  socket: Socket | any;
  username: string;
  onLeaveArena: () => void;
}

const NUMBER_EMOJIS: Record<number, string> = {
  1: '👆',
  2: '✌️',
  3: '🤟',
  4: '🖖',
  5: '🖐️',
  6: '✊',
};

const NUMBER_LABELS: Record<number, string> = {
  1: '1 Run (Index)',
  2: '2 Runs (Index + Middle)',
  3: '3 Runs (3 Fingers)',
  4: '4 Runs (Boundary)',
  5: '5 Runs (Open Palm)',
  6: '6 Runs (Fist / Thumb)',
};

export const HandCricketArena: React.FC<HandCricketArenaProps> = ({
  socket,
  username,
  onLeaveArena,
}) => {
  // Room state from server / peer
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [manualChoice, setManualChoice] = useState<number | null>(null);
  const [choiceLockedIn, setChoiceLockedIn] = useState<number | null>(null);
  const [showLandmarks, setShowLandmarks] = useState(true);

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

  // 1. WebRTC Hook for Direct Peer-to-Peer AV Mesh
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
  });

  // Callback refs to guarantee immediate video playback whenever DOM nodes mount!
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
          node.play().catch((err) => console.log('Local video play catch:', err));
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
          node.play().catch((err) => console.log('Remote video play catch:', err));
        }
      }
    },
    [remoteStream]
  );

  // Safety effects: re-trigger video assignment on phase changes
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

  // 2. Client-side Edge Computer Vision with MediaPipe WASM
  const {
    isModelLoading,
    isModelReady,
    loadError,
    activeDelegate,
    detectedNumber,
    fingerStates,
    handPresent,
    gestureLabel,
    isSampling,
    startSampling,
    stopSampling,
  } = useHandDetection({
    videoRef: localVideoRef as React.RefObject<HTMLVideoElement>,
    canvasRef: showLandmarks ? (canvasRef as React.RefObject<HTMLCanvasElement>) : undefined,
  });

  // Active recognized number (either detected or manually selected)
  const currentPreviewNumber = manualChoice ?? detectedNumber;

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

      // During Phase 1: in the final 2 seconds, sample hand landmarks
      if (seconds === 2) {
        startSampling();
      }

      // At 0s, lock in choice
      if (seconds === 0) {
        const sampledMode = stopSampling();
        const finalChoice = manualChoice ?? sampledMode ?? 6;
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

    const handleGameOver = ({ winnerId }: { winnerId: string }) => {
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
  }, [socket, roomState?.roomId, manualChoice, startSampling, stopSampling]);

  // Handle Matchmaking Actions
  const handleCreateParty = () => {
    if (!socket) return;
    setErrorMsg(null);
    socket.emit('create_room', { username });
  };

  const handleJoinParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !joinCodeInput.trim()) return;
    setErrorMsg(null);
    socket.emit('join_room', {
      roomId: joinCodeInput.trim().toUpperCase(),
      username,
    });
  };

  const handleQuickMatch = () => {
    if (!socket) return;
    setErrorMsg(null);
    socket.emit('quick_match', { username });
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
      <div className="min-h-screen bg-arcade-bg bg-arcade-grid flex flex-col text-slate-100 p-4 sm:p-6 lg:p-8">
        {/* Top Header */}
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-arcade-border">
          <div className="flex items-center gap-3">
            <button
              onClick={onLeaveArena}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-xl sm:text-2xl text-white">
                  HAND CRICKET 1v1
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-500/20 text-arcade-cyan border border-cyan-500/30">
                  Lobby
                </span>
              </div>
              <p className="text-xs text-slate-400">Camera-Powered Face Reveal Street Cricket</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-arcade-cyan animate-pulse" />
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

          {/* Camera Pre-Check & Gesture Preview Card */}
          <div className="p-4 rounded-2xl bg-arcade-card/90 border border-arcade-border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="relative w-28 h-20 rounded-xl overflow-hidden bg-black border border-slate-700 flex-shrink-0">
                <video
                  ref={setLocalVideoNode}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                {!localStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-500 text-[10px] text-center p-1">
                    Waiting for camera...
                  </div>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-arcade-cyan tracking-wider block">
                  Camera & AI Gesture Test
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl">
                    {detectedNumber ? NUMBER_EMOJIS[detectedNumber] : '✋'}
                  </span>
                  <span className="font-mono font-bold text-white text-sm">
                    {detectedNumber ? `${detectedNumber} RUNS` : 'Show hand to camera'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">{gestureLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {loadError ? (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Tap Mode (AI Offline)
                </span>
              ) : isModelLoading ? (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  Loading Edge AI...
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Edge CV ({activeDelegate || 'WASM'})
                </span>
              )}
            </div>
          </div>

          {/* If waiting for second player in a created room */}
          {roomState?.roomId ? (
            <div className="p-8 rounded-3xl bg-arcade-card border border-arcade-border shadow-2xl text-center space-y-6 max-w-lg mx-auto w-full animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-arcade-cyan mx-auto flex items-center justify-center">
                <Users className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Room Access Code
                </span>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="font-display text-4xl sm:text-5xl font-black text-white tracking-widest bg-slate-900/90 px-6 py-2 rounded-2xl border border-arcade-border text-glow-cyan">
                    {roomState.roomId}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                    title="Copy Room Code"
                  >
                    {copiedCode ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Share this 4-character code with your friend to play!
                </p>
              </div>

              {/* Connected Players Status */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400">Host (Batsman):</span>
                  <span className="text-white font-mono">{myPlayer?.username || username} (You)</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400">Challenger (Bowler):</span>
                  {opponentPlayer ? (
                    <span className="text-emerald-400 font-mono flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      {opponentPlayer.username} (Ready)
                    </span>
                  ) : (
                    <span className="text-amber-400 animate-pulse font-mono">Waiting for friend...</span>
                  )}
                </div>
              </div>

              {isHost && (
                <button
                  disabled={!isOpponentConnected}
                  onClick={handleStartMatch}
                  className={`w-full py-3.5 px-6 rounded-xl font-display font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all ${
                    isOpponentConnected
                      ? 'bg-gradient-to-r from-arcade-cyan to-emerald-400 text-slate-950 shadow-neon-cyan hover:scale-[1.02]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Flame className="w-4 h-4 fill-current" />
                  {isOpponentConnected ? 'START THE 1v1 DUEL' : 'WAITING FOR 2ND PLAYER'}
                </button>
              )}
            </div>
          ) : (
            /* Option A vs Option B Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Party Mode */}
              <div className="p-6 rounded-3xl bg-arcade-card border border-arcade-border space-y-6 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-arcade-cyan border border-cyan-500/20 flex items-center justify-center">
                    <Share2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">Party Mode</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Create a private room code or enter a 4-character code from a friend across devices.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleCreateParty}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-arcade-cyan to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-neon-cyan transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Host New Match (Generate Code)
                  </button>

                  <div className="relative flex items-center justify-center">
                    <div className="w-full border-t border-slate-800" />
                    <span className="absolute px-2 bg-arcade-card text-[11px] font-bold text-slate-500 uppercase">
                      OR JOIN WITH CODE
                    </span>
                  </div>

                  <form onSubmit={handleJoinParty} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. NRCU"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-center font-display font-bold tracking-widest text-white uppercase placeholder-slate-600 focus:outline-none focus:border-arcade-cyan"
                    />
                    <button
                      type="submit"
                      disabled={joinCodeInput.trim().length !== 4}
                      className="px-5 rounded-xl font-bold text-xs bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
                    >
                      Join
                    </button>
                  </form>
                </div>
              </div>

              {/* Card 2: Quick Match 1v1 */}
              <div className="p-6 rounded-3xl bg-arcade-card border border-arcade-border space-y-6 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-arcade-neonPink border border-pink-500/20 flex items-center justify-center">
                    <Flame className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">Quick Match Queue</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Auto-match instantly against any student currently waiting across the network.
                  </p>
                </div>

                <button
                  onClick={handleQuickMatch}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-arcade-neonPink to-purple-600 hover:from-pink-500 hover:to-purple-500 shadow-neon-pink transition-all flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Enter Instant 1v1 Queue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW: AUTHORITATIVE GAME ARENA (PHASES 1, 2, 3)
  // ----------------------------------------------------
  const amIBatsman = myPlayer?.role === 'batsman';

  return (
    <div className="min-h-screen bg-arcade-bg bg-arcade-grid flex flex-col text-slate-100 select-none">
      {/* 1. ARENA TOP HUD & SCOREBOARD */}
      <header className="sticky top-0 z-30 w-full border-b border-arcade-border/90 bg-arcade-bg/90 backdrop-blur-xl px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left: Room & Inning info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onLeaveArena}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 transition-colors"
              title="Leave Room"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm text-arcade-cyan tracking-wider">
                  ROOM {roomState.roomId}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                  Inning {roomState.currentInning}/2
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                You are{' '}
                <span className={`font-bold ${amIBatsman ? 'text-arcade-cyan' : 'text-arcade-neonPink'}`}>
                  {amIBatsman ? 'BATSMAN 🏏' : 'BOWLER 🎯'}
                </span>
              </p>
            </div>
          </div>

          {/* Center: Live Big Scoreboard */}
          <div className="flex items-center gap-6 px-6 py-2 rounded-2xl bg-arcade-card border border-arcade-border shadow-inner">
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Score
              </span>
              <div className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                {roomState.currentInningRuns}
                <span className="text-slate-500 text-lg"> / {roomState.currentInningWickets}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800" />

            <div className="text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Balls Bowled
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-arcade-cyan">
                {roomState.currentBallsBowled}
                <span className="text-slate-500 text-sm"> / {roomState.totalBallsPerInning}</span>
              </div>
            </div>

            {roomState.targetRuns !== null && (
              <>
                <div className="h-8 w-px bg-slate-800" />
                <div className="text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                    Target
                  </span>
                  <div className="font-display text-xl sm:text-2xl font-black text-amber-400">
                    {roomState.targetRuns}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Ball-by-ball history strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-xs">
            {roomState.ballHistory.slice(-6).map((ball, idx) => (
              <span
                key={idx}
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs border ${
                  ball.isWicket
                    ? 'bg-rose-600/30 text-rose-400 border-rose-500 animate-bounce'
                    : ball.runsScored === 6
                    ? 'bg-purple-600/30 text-purple-300 border-purple-500 font-extrabold'
                    : ball.runsScored === 4
                    ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {ball.isWicket ? 'W' : ball.runsScored}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* 2. MAIN SPLIT-SCREEN WEBRTC ARENA */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {/* ==================================================== */}
        {/* LEFT COLUMN: LOCAL FEED (ME) WITH EDGE CV OVERLAYS */}
        {/* ==================================================== */}
        <section className="relative rounded-3xl overflow-hidden bg-arcade-card border border-arcade-border flex flex-col justify-between shadow-2xl min-h-[400px] sm:min-h-[460px]">
          {/* Header Tag */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl text-xs font-bold font-mono bg-slate-900/90 text-white border border-slate-700/80 backdrop-blur-md flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {username} (YOU)
            </span>
            <span
              className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border ${
                amIBatsman
                  ? 'bg-cyan-500/20 text-arcade-cyan border-cyan-500/40'
                  : 'bg-pink-500/20 text-arcade-neonPink border-pink-500/40'
              }`}
            >
              {amIBatsman ? 'BATSMAN' : 'BOWLER'}
            </span>
          </div>

          {/* Local Video & Landmark Canvas Overlay */}
          <div className="relative w-full h-full flex-1 flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={setLocalVideoNode}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            {/* Neon CV Landmark Canvas */}
            <canvas
              ref={(node) => {
                canvasRef.current = node;
              }}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none transform -scale-x-100"
            />

            {/* Media fallback if camera is disabled or permission issue */}
            {(!isCameraActive || mediaError) && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-slate-400 p-6 text-center gap-3">
                <CameraOff className="w-12 h-12 text-slate-600" />
                <span className="text-sm font-semibold text-rose-300">
                  {mediaError || 'Camera is turned off'}
                </span>
                <span className="text-xs text-slate-400">
                  You can use the 1–6 tap buttons below to play manually!
                </span>
              </div>
            )}

            {/* REAL-TIME NUMBER RECOGNITION LIVE REASSURANCE CARD */}
            <div className="absolute top-4 right-4 z-20 pointer-events-none">
              <div className="p-3 rounded-2xl bg-slate-900/95 border-2 border-arcade-cyan/80 shadow-neon-cyan backdrop-blur-md flex items-center gap-3 animate-fadeIn">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
                  {currentPreviewNumber ? NUMBER_EMOJIS[currentPreviewNumber] : '✋'}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-arcade-cyan">
                      RECOGNIZING NOW
                    </span>
                    <span className="w-2 h-2 rounded-full bg-arcade-cyan animate-ping" />
                  </div>
                  <div className="font-display font-black text-lg text-white">
                    {currentPreviewNumber ? `${currentPreviewNumber} RUNS` : 'Position Hand'}
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono">
                    {gestureLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* In-Video Bottom Controls */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between pointer-events-none">
              {/* Detailed Finger Status Breakdown for User Reassurance */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md space-y-1 pointer-events-auto">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                  Finger Tracking
                </span>
                <div className="flex gap-1.5 text-[10px] font-mono">
                  <span
                    className={`px-1.5 py-0.5 rounded border ${
                      fingerStates.thumb
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    Thu
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border ${
                      fingerStates.index
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    Idx
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border ${
                      fingerStates.middle
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    Mid
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border ${
                      fingerStates.ring
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    Rng
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border ${
                      fingerStates.pinky
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    Pnk
                  </span>
                </div>
              </div>

              {/* Camera & Mic Controls */}
              <div className="flex gap-2 pointer-events-auto">
                <button
                  onClick={toggleCamera}
                  className={`p-2.5 rounded-xl border backdrop-blur-md transition-colors ${
                    isCameraActive
                      ? 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
                      : 'bg-rose-600/30 text-rose-400 border-rose-500'
                  }`}
                  title="Toggle Camera"
                >
                  {isCameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleMic}
                  className={`p-2.5 rounded-xl border backdrop-blur-md transition-colors ${
                    isMicActive
                      ? 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
                      : 'bg-rose-600/30 text-rose-400 border-rose-500'
                  }`}
                  title="Toggle Microphone"
                >
                  {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Manual Fallback Selector Buttons (1 to 6) with Real-Time AI Highlight */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 hidden sm:inline">
              Tap / Override:
            </span>
            <div className="flex-1 grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const isAIMatching = detectedNumber === num;
                const isSelected = manualChoice === num || choiceLockedIn === num;

                return (
                  <button
                    key={num}
                    onClick={() => setManualChoice(num)}
                    disabled={roomState.phase !== 'PHASE_1_COUNTDOWN'}
                    className={`relative py-2 rounded-xl font-mono font-bold text-xs transition-all flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-arcade-cyan text-slate-950 font-black scale-105 shadow-neon-cyan border-2 border-white'
                        : isAIMatching
                        ? 'bg-cyan-950/80 text-arcade-cyan border-2 border-arcade-cyan shadow-sm animate-pulse'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 border border-slate-700'
                    }`}
                  >
                    <span className="text-sm">{NUMBER_EMOJIS[num]}</span>
                    <span>{num}</span>
                    {isAIMatching && !isSelected && (
                      <span className="absolute -top-1.5 px-1 rounded-full text-[8px] font-black uppercase bg-arcade-cyan text-slate-950">
                        AI
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* RIGHT COLUMN: REMOTE OPPONENT FEED WITH CONDITIONAL BLUR */}
        {/* ==================================================== */}
        <section className="relative rounded-3xl overflow-hidden bg-arcade-card border border-arcade-border flex flex-col justify-between shadow-2xl min-h-[400px] sm:min-h-[460px]">
          {/* Header Tag */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl text-xs font-bold font-mono bg-slate-900/90 text-white border border-slate-700/80 backdrop-blur-md flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-arcade-neonPink animate-pulse" />
              {opponentPlayer?.username || 'Opponent'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border ${
                amIBatsman
                  ? 'bg-pink-500/20 text-arcade-neonPink border-pink-500/40'
                  : 'bg-cyan-500/20 text-arcade-cyan border-cyan-500/40'
              }`}
            >
              {amIBatsman ? 'BOWLER' : 'BATSMAN'}
            </span>
          </div>

          {/* Remote Opponent Video Feed */}
          <div className="relative w-full h-full flex-1 flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={setRemoteVideoNode}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-all duration-700 ${
                isSecretPhase
                  ? 'filter blur-3xl scale-110 pointer-events-none'
                  : 'filter blur-0 scale-100'
              }`}
            />

            {!remoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-slate-500 text-xs p-4 text-center gap-2">
                <Users className="w-8 h-8 text-slate-600 animate-pulse" />
                <span>Connecting peer video stream...</span>
              </div>
            )}

            {/* PHASE 1: CONDITIONAL SECRET DELIVERY MASK OVERLAY */}
            {isSecretPhase && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-black/60 backdrop-blur-xl">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 text-arcade-cyan flex items-center justify-center animate-pulse">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="mt-4 font-display text-lg font-black tracking-wider text-white">
                  SECRET DELIVERY IN PROGRESS
                </h3>
                <p className="mt-1 text-xs text-slate-300 max-w-xs leading-relaxed">
                  Opponent's video is blurred and audio muted. Ready your hand gesture!
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  <span>Remote Audio Muted</span>
                </div>
              </div>
            )}

            {/* PHASE 2 & 3: REVEAL STATUS INDICATOR */}
            {!isSecretPhase && (
              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700/80 backdrop-blur-md">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Live Reaction Unmasked</span>
              </div>
            )}
          </div>

          {/* Opponent Choice Reveal Bar */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Opponent Choice:</span>
            {isSecretPhase ? (
              <span className="font-mono font-bold text-amber-400 animate-pulse">
                [LOCKED & HIDDEN]
              </span>
            ) : roomState.lastBallResult ? (
              <span className="font-mono font-bold text-arcade-cyan text-sm flex items-center gap-1.5">
                <span>
                  {NUMBER_EMOJIS[amIBatsman ? roomState.lastBallResult.bowlerChoice : roomState.lastBallResult.batsmanChoice]}
                </span>
                <span>
                  {amIBatsman
                    ? `Bowler played ${roomState.lastBallResult.bowlerChoice}`
                    : `Batsman played ${roomState.lastBallResult.batsmanChoice}`}
                </span>
              </span>
            ) : (
              <span className="text-slate-500 font-mono">—</span>
            )}
          </div>
        </section>

        {/* ==================================================== */}
        {/* CENTER FLOATING ACTION HUD / 3-PHASE CONTROLLER */}
        {/* ==================================================== */}
        <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center">
          {/* Phase 1: 5-Second Secret Delivery Countdown */}
          {roomState.phase === 'PHASE_1_COUNTDOWN' && (
            <div className="p-6 rounded-3xl bg-slate-900/95 border border-cyan-500/40 shadow-neon-cyan flex flex-col items-center space-y-3 max-w-md w-full animate-fadeIn">
              <span className="text-xs uppercase font-extrabold tracking-widest text-arcade-cyan flex items-center gap-1.5">
                <Clock className="w-4 h-4 animate-spin-slow" />
                Phase 1: Secret Delivery
              </span>
              <div className="font-display text-5xl sm:text-6xl font-black text-white text-glow-cyan">
                {roomState.phaseSecondsRemaining}s
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono">
                <Eye className="w-4 h-4 text-arcade-cyan" />
                <span>
                  Selected: <strong>{currentPreviewNumber ? `${currentPreviewNumber} Runs` : 'Waiting for hand...'}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Phase 2: State Resolution & Outcome Banner */}
          {roomState.phase === 'PHASE_2_REVEAL' && roomState.lastBallResult && (
            <div
              className={`p-6 rounded-3xl border shadow-2xl flex flex-col items-center space-y-4 max-w-lg w-full animate-bounce ${
                roomState.lastBallResult.isWicket
                  ? 'bg-rose-950/90 border-rose-500/80 shadow-rose-500/30'
                  : 'bg-slate-900/95 border-emerald-500/80 shadow-neon-green'
              }`}
            >
              <div className="font-display text-3xl sm:text-4xl font-black tracking-wider text-center">
                {roomState.lastBallResult.isWicket ? (
                  <span className="text-rose-400 text-glow-pink">🔥 WICKET! OUT! 🔥</span>
                ) : roomState.lastBallResult.runsScored === 6 ? (
                  <span className="text-purple-300">⚡ MAXIMUM! 6 RUNS! ⚡</span>
                ) : roomState.lastBallResult.runsScored === 4 ? (
                  <span className="text-emerald-300">🏏 BOUNDARY! 4 RUNS! 🏏</span>
                ) : (
                  <span className="text-white">
                    +{roomState.lastBallResult.runsScored} RUNS SCORED!
                  </span>
                )}
              </div>

              {/* Reveal Comparison Badges */}
              <div className="flex items-center gap-6 pt-2 font-mono">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">
                    Batsman
                  </span>
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-600 flex flex-col items-center justify-center text-xl font-black text-arcade-cyan">
                    <span>{NUMBER_EMOJIS[roomState.lastBallResult.batsmanChoice]}</span>
                    <span className="text-xs">{roomState.lastBallResult.batsmanChoice}</span>
                  </div>
                </div>
                <span className="font-display text-slate-500 font-black text-xl">VS</span>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Bowler</span>
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-600 flex flex-col items-center justify-center text-xl font-black text-arcade-neonPink">
                    <span>{NUMBER_EMOJIS[roomState.lastBallResult.bowlerChoice]}</span>
                    <span className="text-xs">{roomState.lastBallResult.bowlerChoice}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 italic">{roomState.lastBallResult.commentary}</p>
            </div>
          )}

          {/* Phase 3: Banter Window */}
          {roomState.phase === 'PHASE_3_BANTER' && (
            <div className="p-6 rounded-3xl bg-arcade-card/95 border border-arcade-border shadow-2xl flex flex-col items-center space-y-4 max-w-md w-full animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-display text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Phase 3: Banter Window ({roomState.phaseSecondsRemaining}s)
                </span>
              </div>

              <p className="text-xs text-slate-300 text-center">
                Unmuted reaction window! Tease your mate or discuss tactics.
              </p>

              <button
                onClick={handleNextBall}
                className="w-full py-3.5 px-6 rounded-xl font-display font-bold text-sm tracking-wider text-slate-950 bg-gradient-to-r from-arcade-cyan to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-neon-cyan flex items-center justify-center gap-2 transition-all"
              >
                <ArrowRight className="w-4 h-4 stroke-[3]" />
                DELIVER NEXT BALL NOW
              </button>
            </div>
          )}

          {/* Inning Transition Screen */}
          {roomState.phase === 'INNING_TRANSITION' && (
            <div className="p-8 rounded-3xl bg-slate-900/95 border border-amber-500/60 shadow-2xl text-center space-y-4 max-w-md w-full animate-fadeIn">
              <span className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                Inning 1 Complete!
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-black text-white">
                ROLES REVERSED!
              </h3>
              <p className="text-xs text-slate-300">
                Target set to{' '}
                <span className="font-display font-bold text-amber-400 text-lg">
                  {roomState.targetRuns} runs
                </span>
                . Batsman and Bowler roles have flipped!
              </p>
              <button
                onClick={handleNextBall}
                className="w-full py-3 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 transition-all"
              >
                Start 2nd Inning
              </button>
            </div>
          )}

          {/* Game Over Screen */}
          {roomState.phase === 'GAME_OVER' && (
            <div className="p-8 rounded-3xl bg-slate-900/95 border border-arcade-cyan/60 shadow-neon-cyan text-center space-y-5 max-w-md w-full animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                <Trophy className="w-8 h-8" />
              </div>
              <h3 className="font-display text-3xl font-black text-white text-glow-cyan">
                {roomState.winnerId === myPlayerId
                  ? 'VICTORY! 🏆'
                  : roomState.winnerId
                  ? 'DEFEATED! 💔'
                  : 'MATCH TIED! 🤝'}
              </h3>
              <p className="text-sm text-slate-300 font-medium">{roomState.winMessage}</p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onLeaveArena}
                  className="flex-1 py-3 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Exit to Lobby
                </button>
                <button
                  onClick={handleRematch}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-arcade-cyan to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-neon-cyan transition-all"
                >
                  Play Rematch
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
