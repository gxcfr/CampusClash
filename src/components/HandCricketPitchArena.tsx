'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Volume2,
  VolumeX,
  PhoneOff,
  Hand,
  ArrowRight,
  Sparkles,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  User,
  Flame,
} from 'lucide-react';

export interface HandCricketPitchArenaProps {
  roomCode: string;
  isBatting: boolean;
  score: { runs: number; wickets: number; target?: number | null; over: string };
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  detectedNumber: number | null;
  phase: 'countdown' | 'reveal' | 'banter';
  timer: number;
  lastBallResult?: { runs: number; isOut: boolean; batChoice: number; bowlChoice: number } | null;
  onNextBall: () => void;
  onLeave: () => void;
  onSelectManualChoice?: (num: number) => void;
  manualChoice?: number | null;
  localVideoRef?: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef?: React.RefObject<HTMLVideoElement | null>;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  cameraMode?: 'camera' | 'no-camera';
  myUsername?: string;
  opponentUsername?: string;
  isCameraActive?: boolean;
  isMicActive?: boolean;
  onToggleCamera?: () => void;
  onToggleMic?: () => void;
}

const NUMBER_EMOJIS: Record<number, string> = {
  1: '👆',
  2: '✌️',
  3: '🤟',
  4: '🏏',
  5: '🖐️',
  6: '💥',
};

const NUMBER_RUN_NAMES: Record<number, string> = {
  1: 'Single Run',
  2: 'Double',
  3: 'Three Runs',
  4: 'Boundary (4)',
  5: 'Overthrow (5)',
  6: 'Maximum Sixer (6)',
};

export const HandCricketPitchArena: React.FC<HandCricketPitchArenaProps> = ({
  roomCode,
  isBatting,
  score,
  localStream,
  remoteStream,
  detectedNumber,
  phase,
  timer,
  lastBallResult,
  onNextBall,
  onLeave,
  onSelectManualChoice,
  manualChoice,
  localVideoRef: externalLocalVideoRef,
  remoteVideoRef: externalRemoteVideoRef,
  canvasRef: externalCanvasRef,
  cameraMode = 'camera',
  myUsername = 'You',
  opponentUsername = 'Opponent',
  isCameraActive = true,
  isMicActive = true,
  onToggleCamera,
  onToggleMic,
}) => {
  const [remoteAudioMuted, setRemoteAudioMuted] = useState(false);
  const internalLocalVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const internalRemoteVideoRef = React.useRef<HTMLVideoElement | null>(null);

  // Keyboard shortcut listener for manual number selection (1 to 6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'countdown') return;
      const keyNum = parseInt(e.key, 10);
      if (keyNum >= 1 && keyNum <= 6) {
        onSelectManualChoice?.(keyNum);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, onSelectManualChoice]);

  // Video node assignment with autoplay guarantees
  const setLocalVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      internalLocalVideoRef.current = node;
      if (externalLocalVideoRef) {
        (externalLocalVideoRef as any).current = node;
      }
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
    [localStream, externalLocalVideoRef]
  );

  const setRemoteVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      internalRemoteVideoRef.current = node;
      if (externalRemoteVideoRef) {
        (externalRemoteVideoRef as any).current = node;
      }
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
    [remoteStream, externalRemoteVideoRef]
  );

  useEffect(() => {
    if (internalLocalVideoRef.current && localStream) {
      if (internalLocalVideoRef.current.srcObject !== localStream) {
        internalLocalVideoRef.current.srcObject = localStream;
      }
      internalLocalVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (internalRemoteVideoRef.current && remoteStream) {
      if (internalRemoteVideoRef.current.srcObject !== remoteStream) {
        internalRemoteVideoRef.current.srcObject = remoteStream;
      }
      internalRemoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const toggleRemoteAudio = () => {
    if (remoteStream) {
      const nextMuted = !remoteAudioMuted;
      setRemoteAudioMuted(nextMuted);
      remoteStream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    } else {
      setRemoteAudioMuted(!remoteAudioMuted);
    }
  };

  const activeNumber = manualChoice ?? detectedNumber;
  const isNoCamera = cameraMode === 'no-camera';

  return (
    <div className="relative w-full h-[100dvh] bg-[#0c1017] flex flex-col justify-between overflow-hidden select-none font-sans text-slate-100">
      {/* Background Turf & 22-Yard Pitch Pattern */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-80 bg-gradient-to-b from-[#2a1d12]/20 via-[#10301c]/25 to-[#2a1d12]/20 pointer-events-none border-x border-[#8b6944]/20" />

      {/* Top Header: Stadium Scoreboard */}
      <header className="relative z-30 shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 bg-[#121622]/90 backdrop-blur-md border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <span className="text-xs font-black tracking-wider text-emerald-400 uppercase font-mono block">
              ROOM: {roomCode}
            </span>
            <span className="text-[10px] text-zinc-400 font-semibold uppercase">
              {isNoCamera ? 'Classic Duel (No Cam)' : 'Vision Duel (Camera)'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3.5 bg-zinc-900/90 px-4 py-1.5 rounded-full border border-zinc-700/80 shadow-inner">
          <div className="text-center">
            <span className="text-[9px] text-zinc-400 block uppercase font-bold tracking-tight">
              Runs/Wkts
            </span>
            <span className="text-sm font-extrabold text-white leading-none font-mono">
              {score.runs}/{score.wickets}
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-700" />

          <div className="text-center">
            <span className="text-[9px] text-zinc-400 block uppercase font-bold tracking-tight">
              Target
            </span>
            <span className="text-sm font-extrabold text-amber-400 leading-none font-mono">
              {score.target ?? '--'}
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-700" />

          <div className="text-center">
            <span className="text-[9px] text-zinc-400 block uppercase font-bold tracking-tight">
              Overs
            </span>
            <span className="text-sm font-extrabold text-zinc-200 leading-none font-mono">
              {score.over}
            </span>
          </div>
        </div>
      </header>

      {/* TOP HALF: Striker's End (Opponent End) */}
      <div className="relative flex-1 min-h-0 w-full p-2 flex flex-col justify-end">
        <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-emerald-900/50 bg-[#141926] shadow-xl flex items-center justify-center">
          {/* CAMERA FEED OR AVATAR CARD */}
          {!isNoCamera ? (
            <>
              <video
                ref={setRemoteVideoNode}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-all duration-700 ${
                  phase === 'countdown'
                    ? 'blur-3xl brightness-40 scale-110 pointer-events-none'
                    : 'blur-0 brightness-100 scale-100'
                }`}
              />
              {phase === 'countdown' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/60 backdrop-blur-xl">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center animate-pulse mb-2">
                    <Shield className="w-7 h-7 text-emerald-400" />
                  </div>
                  <span className="text-sm font-bold text-emerald-200 tracking-wide font-display">
                    OPPONENT IN SECRET STANCE
                  </span>
                  <span className="text-[11px] text-zinc-400 mt-0.5">
                    Live face reaction reveals at 0s
                  </span>
                </div>
              )}
              {!remoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-zinc-400 text-xs font-mono gap-2">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                    <User className="w-6 h-6" />
                  </div>
                  <span>{opponentUsername} (Connecting stream...)</span>
                </div>
              )}
            </>
          ) : (
            /* NO-CAMERA MODE: OPPONENT AVATAR CARD */
            <div className="relative w-full h-full bg-gradient-to-b from-[#182030] to-[#121622] flex flex-col items-center justify-center p-4 text-center">
              <div className="relative">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border-2 ${phase === 'countdown' ? 'border-amber-400/60 animate-pulse' : 'border-zinc-700'} flex items-center justify-center shadow-lg`}>
                  <User className="w-10 h-10 text-amber-300" />
                </div>
                {phase === 'countdown' && (
                  <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950 shadow-md animate-bounce">
                    Choosing...
                  </span>
                )}
              </div>

              <h4 className="mt-3 font-bold text-white text-base font-display">
                {opponentUsername}
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                {!isBatting ? '🏏 Striker (Batsman)' : '🎾 Bowler'}
              </p>

              {/* Reveal Outcome Pill for No-Camera Mode */}
              {phase !== 'countdown' && lastBallResult && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-3 px-4 py-1.5 rounded-full bg-zinc-900 border border-emerald-500/40 text-emerald-400 font-mono font-bold text-xs flex items-center gap-1.5 shadow-md"
                >
                  <span>Chose:</span>
                  <span className="text-base leading-none">
                    {NUMBER_EMOJIS[!isBatting ? lastBallResult.batChoice : lastBallResult.bowlChoice]}
                  </span>
                  <span>{!isBatting ? lastBallResult.batChoice : lastBallResult.bowlChoice} Runs</span>
                </motion.div>
              )}
            </div>
          )}

          {/* 3D Wooden Stumps Graphic at Striker's End */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 opacity-75 pointer-events-none">
            <div className="absolute -top-1 left-0 right-0 h-1 bg-amber-100 rounded-full" />
            <div className="w-2 h-7 bg-gradient-to-b from-amber-200 to-amber-700 rounded-t-sm shadow-md" />
            <div className="w-2 h-7 bg-gradient-to-b from-amber-200 to-amber-700 rounded-t-sm shadow-md" />
            <div className="w-2 h-7 bg-gradient-to-b from-amber-200 to-amber-700 rounded-t-sm shadow-md" />
          </div>

          {/* Opponent Role Badge */}
          <div className="absolute bottom-2.5 left-2.5 z-10 bg-black/75 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 flex items-center gap-1.5 shadow-lg">
            <span className="text-xs font-bold text-white">
              {!isBatting ? '🏏 Striker' : '🎾 Bowler'}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400">
              ({opponentUsername})
            </span>
          </div>
        </div>

        {/* Popping Crease White Line */}
        <div className="w-full flex items-center justify-between px-4 mt-1 pointer-events-none">
          <div className="h-0.5 w-16 bg-white/40" />
          <span className="text-[9px] tracking-widest text-zinc-400 uppercase font-mono font-bold">
            POPPING CREASE
          </span>
          <div className="h-0.5 w-16 bg-white/40" />
        </div>
      </div>

      {/* CENTER HUD: The Pitch Strip, Cricket Ball Timer & Big Outcome Banner */}
      <div className="relative z-30 shrink-0 h-14 sm:h-16 w-full flex items-center justify-center px-4 my-0.5">
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-10 bg-[#422e1b]/30 border-y-2 border-[#8b6944]/40 rounded-xl pointer-events-none flex items-center justify-around">
          <div className="w-10 h-px bg-white/20 rotate-45" />
          <div className="w-10 h-px bg-white/20 -rotate-45" />
          <div className="w-10 h-px bg-white/20 rotate-45" />
        </div>

        {/* Cricket Ball Timer */}
        <motion.div
          key={phase + timer}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-red-600 via-red-700 to-red-950 border-2 border-white/90 shadow-[0_0_20px_rgba(220,38,38,0.6)] flex flex-col items-center justify-center text-white"
        >
          <div className="absolute inset-0 rounded-full border-r-2 border-dashed border-white/70 pointer-events-none" />
          <span className="text-sm font-black leading-none font-display">
            {timer}s
          </span>
          <span className="text-[8px] uppercase tracking-tight text-red-100 font-extrabold mt-0.5">
            {phase === 'countdown' ? 'LOCK' : 'BANTER'}
          </span>
        </motion.div>

        {/* Big Outcome Banner */}
        <AnimatePresence>
          {phase === 'reveal' && lastBallResult && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className={`absolute z-40 px-6 py-2.5 rounded-2xl shadow-2xl font-black text-base sm:text-lg flex items-center gap-2 border-2 ${
                lastBallResult.isOut
                  ? 'bg-red-600 text-white border-red-200 shadow-red-500/60'
                  : 'bg-emerald-500 text-slate-950 border-white shadow-emerald-500/60'
              }`}
            >
              {lastBallResult.isOut ? (
                <>💥 WICKET! OUT! ({lastBallResult.batChoice} = {lastBallResult.bowlChoice})</>
              ) : (
                <>🏏 +{lastBallResult.runs} RUNS! ({lastBallResult.batChoice} vs {lastBallResult.bowlChoice})</>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Centered Skip Banter Button (Dead Center of Screen on all screens & mobile) */}
        {phase === 'banter' && (
          <motion.button
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: [1, 1.05, 1], opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            onClick={onNextBall}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-5 sm:px-7 py-2.5 sm:py-3 rounded-full font-black text-xs sm:text-sm bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.85)] border-2 border-white flex items-center gap-2 tracking-wide whitespace-nowrap cursor-pointer active:scale-95 transition-transform"
          >
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
            <span>SKIP BANTER & BOWL NOW ({timer}s)</span>
          </motion.button>
        )}
      </div>

      {/* BOTTOM HALF: Bowler's End (Local End) */}
      <div className="relative flex-1 min-h-0 w-full p-2 flex flex-col justify-start">
        {/* Bowling Crease White Line */}
        <div className="w-full flex items-center justify-between px-4 mb-1 pointer-events-none">
          <div className="h-0.5 w-16 bg-white/40" />
          <span className="text-[9px] tracking-widest text-zinc-400 uppercase font-mono font-bold">
            BOWLING CREASE
          </span>
          <div className="h-0.5 w-16 bg-white/40" />
        </div>

        <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-emerald-900/50 bg-[#141926] shadow-xl flex items-center justify-center">
          {/* CAMERA FEED OR LOCAL AVATAR CARD */}
          {!isNoCamera ? (
            <>
              {isCameraActive ? (
                <video
                  ref={setLocalVideoNode}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-2">
                  <CameraOff className="w-10 h-10 text-zinc-600" />
                  <span className="text-xs font-mono">Camera Paused</span>
                </div>
              )}

              {externalCanvasRef && isCameraActive && (
                <canvas
                  ref={externalCanvasRef as any}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none -scale-x-100"
                />
              )}
            </>
          ) : (
            /* NO-CAMERA MODE: LOCAL AVATAR CARD */
            <div className="relative w-full h-full bg-gradient-to-t from-[#182030] to-[#121622] flex flex-col items-center justify-center p-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border-2 border-emerald-400/60 flex items-center justify-center shadow-lg">
                <User className="w-10 h-10 text-emerald-300" />
              </div>
              <h4 className="mt-3 font-bold text-white text-base font-display">
                {myUsername} (You)
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isBatting ? '🏏 Striker (Batsman)' : '🎾 Bowler'}
              </p>
            </div>
          )}

          {/* 3D Wooden Stumps Graphic at Bowler's End */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 opacity-75 pointer-events-none">
            <div className="w-2 h-7 bg-gradient-to-t from-amber-200 to-amber-700 rounded-b-sm shadow-md" />
            <div className="w-2 h-7 bg-gradient-to-t from-amber-200 to-amber-700 rounded-b-sm shadow-md" />
            <div className="w-2 h-7 bg-gradient-to-t from-amber-200 to-amber-700 rounded-b-sm shadow-md" />
          </div>

          {/* Active Choice Indicator Pill */}
          <div className="absolute top-2.5 left-2.5 z-10">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border-2 backdrop-blur-md shadow-lg transition-all ${
                activeNumber
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300'
                  : 'bg-black/80 border-amber-500/60 text-amber-300'
              }`}
            >
              <Hand className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-xs font-extrabold font-mono flex items-center gap-1.5">
                {activeNumber ? (
                  <>
                    <span>{NUMBER_EMOJIS[activeNumber]}</span>
                    <span>{activeNumber} RUNS</span>
                  </>
                ) : (
                  <span>Select Choice (1-6)</span>
                )}
              </span>
            </div>
          </div>

          {/* User Role Badge */}
          <div className="absolute bottom-2.5 left-2.5 z-10 bg-black/75 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 flex items-center gap-1.5 shadow-lg">
            <span className="text-xs font-bold text-white">
              {isBatting ? '🏏 Striker' : '🎾 Bowler'}
            </span>
            <span className="text-[10px] font-extrabold text-emerald-400">
              (You)
            </span>
          </div>
        </div>
      </div>

      {/* PROMINENT NUMBER SELECTION KEYPAD (1 TO 6) - BOTH MODES */}
      <div className="relative z-30 shrink-0 w-full max-w-lg mx-auto px-3 sm:px-4 py-1.5 bg-[#0d111a]/95 backdrop-blur-md border-t border-zinc-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1 font-mono">
            <Hand className="w-3 h-3" />
            {activeNumber
              ? `Locked In: ${activeNumber} Runs (${NUMBER_RUN_NAMES[activeNumber]})`
              : 'Choose Your Delivery (1 to 6 Runs):'}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">Keyboard [1-6]</span>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((num) => {
            const isSelected = activeNumber === num;
            return (
              <button
                key={num}
                onClick={() => onSelectManualChoice?.(num)}
                disabled={phase !== 'countdown'}
                className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-gradient-to-t from-emerald-500 to-teal-400 text-slate-950 font-black shadow-lg scale-105 border-2 border-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 disabled:opacity-40'
                }`}
                title={`Select ${num} runs`}
              >
                <span className="text-base leading-none">{NUMBER_EMOJIS[num]}</span>
                <span className="text-xs font-black font-mono mt-0.5">{num}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STADIUM ACTION FOOTER WITH MUTE & CAMERA BUTTONS */}
      <footer className="relative z-30 shrink-0 px-3 sm:px-4 py-2 bg-[#090c14] border-t border-zinc-800 flex items-center gap-2">
        {/* Leave Match */}
        <button
          onClick={onLeave}
          className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/30 text-red-400 hover:bg-red-900/60 transition-colors flex items-center justify-center shrink-0"
          title="Leave Match"
        >
          <PhoneOff className="w-4 h-4" />
        </button>

        {/* Turn Off / On Camera (Only in camera mode) */}
        {!isNoCamera && onToggleCamera && (
          <button
            onClick={onToggleCamera}
            className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center shrink-0 ${
              !isCameraActive
                ? 'bg-red-950/60 border-red-500/40 text-red-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            }`}
            title={isCameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isCameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
          </button>
        )}

        {/* Mute / Unmute Microphone (Only in camera mode) */}
        {!isNoCamera && onToggleMic && (
          <button
            onClick={onToggleMic}
            className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center shrink-0 ${
              !isMicActive
                ? 'bg-red-950/60 border-red-500/40 text-red-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            }`}
            title={isMicActive ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
        )}

        {/* Mute Opponent Audio */}
        {!isNoCamera && (
          <button
            onClick={toggleRemoteAudio}
            className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center shrink-0 ${
              remoteAudioMuted
                ? 'bg-red-950/60 border-red-500/40 text-red-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            }`}
            title={remoteAudioMuted ? 'Unmute Opponent Audio' : 'Mute Opponent Audio'}
          >
            {remoteAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}

        {/* Action / Status Display */}
        {phase === 'banter' ? (
          <button
            onClick={onNextBall}
            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-98 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 truncate"
          >
            <ArrowRight className="w-4 h-4 stroke-[3] shrink-0" />
            <span className="truncate">NEXT DELIVERY NOW</span>
          </button>
        ) : (
          <div className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center text-xs font-mono font-medium text-emerald-400 flex items-center justify-center gap-2 truncate">
            <Sparkles className="w-3.5 h-3.5 animate-spin-slow shrink-0" />
            <span className="truncate">
              {phase === 'countdown'
                ? `Delivery in flight! (${timer}s remaining)`
                : 'Resolving delivery outcome...'}
            </span>
          </div>
        )}

        {/* Footer Version Tag */}
        <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline shrink-0">
          v0.6
        </span>
      </footer>
    </div>
  );
};

export default HandCricketPitchArena;
