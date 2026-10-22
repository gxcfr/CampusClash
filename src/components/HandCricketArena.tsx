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
import { HandCricketPitchArena } from './HandCricketPitchArena';

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

          {/* Quick Match Searching Radar */}
          {roomState?.phase === 'MATCHMAKING' ? (
            <div className="p-8 rounded-3xl bg-arcade-card border border-arcade-border shadow-2xl text-center space-y-6 max-w-lg mx-auto w-full animate-fadeIn">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-arcade-cyan animate-ping opacity-60" />
                <span className="absolute inset-2 rounded-full border border-arcade-cyan animate-pulse" />
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-arcade-cyan flex items-center justify-center shadow-neon-cyan">
                  <Users className="w-7 h-7" />
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-arcade-cyan">
                  Global Campus Matchmaking
                </span>
                <h3 className="mt-1 font-display text-2xl font-black text-white">
                  SEARCHING FOR 1v1 OPPONENT...
                </h3>
                <p className="mt-2 text-xs text-slate-400 max-w-xs mx-auto">
                  Waiting for another student to join the queue. Pairing is instant and automatic!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Matchmaking Pool: Online & Listening</span>
              </div>

              <button
                onClick={onLeaveArena}
                className="w-full py-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel Matchmaking
              </button>
            </div>
          ) : roomState?.roomId ? (
            <div className="p-8 rounded-3xl bg-arcade-card border border-arcade-border shadow-2xl text-center space-y-6 max-w-lg mx-auto w-full animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-arcade-cyan mx-auto flex items-center justify-center">
                <Users className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {roomState.mode === 'quick' ? 'Match Found!' : 'Room Access Code'}
                </span>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="font-display text-4xl sm:text-5xl font-black text-white tracking-widest bg-slate-900/90 px-6 py-2 rounded-2xl border border-arcade-border text-glow-cyan">
                    {roomState.roomId}
                  </span>
                  {roomState.mode !== 'quick' && (
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
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {roomState.mode === 'quick'
                    ? 'Opponent paired via Quick Match queue! Ready to clash.'
                    : 'Share this 4-character code with your friend to play!'}
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
  // VIEW: 22-YARD CRICKET PITCH ARENA (THE VERTICAL DUEL)
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
    <div className="relative w-full min-h-[100dvh] bg-[#09140c] flex flex-col items-center justify-center">
      {/* 22-Yard Vertical Cricket Pitch Duel Arena */}
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
          localStream={localStream}
          remoteStream={remoteStream}
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
          canvasRef={showLandmarks ? (canvasRef as React.RefObject<HTMLCanvasElement>) : undefined}
        />

        {/* Inning Transition Modal */}
        {roomState.phase === 'INNING_TRANSITION' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="p-8 rounded-3xl bg-slate-900/95 border border-amber-500/60 shadow-2xl text-center space-y-4 max-w-md w-full">
              <span className="text-xs font-bold uppercase text-amber-400 tracking-wider font-mono">
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
            <div className="p-8 rounded-3xl bg-slate-900/95 border border-arcade-cyan/60 shadow-neon-cyan text-center space-y-5 max-w-md w-full">
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
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-arcade-cyan to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-neon-cyan transition-all font-display tracking-wider"
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
