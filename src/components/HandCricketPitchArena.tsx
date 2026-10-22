'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Volume2, VolumeX, PhoneOff, Hand, ArrowRight, Sparkles } from 'lucide-react';

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
}

const NUMBER_EMOJIS: Record<number, string> = {
  1: '👆',
  2: '✌️',
  3: '🤟',
  4: '🖖',
  5: '🖐️',
  6: '✊',
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
}) => {
  const [muted, setMuted] = useState(false);
  const internalLocalVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const internalRemoteVideoRef = React.useRef<HTMLVideoElement | null>(null);

  // Callback refs to guarantee immediate video playback on mobile
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
          node.play().catch((err) => console.log('Local video play catch:', err));
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
          node.play().catch((err) => console.log('Remote video play catch:', err));
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

  const toggleMute = () => {
    if (remoteStream) {
      const nextMuted = !muted;
      setMuted(nextMuted);
      remoteStream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    } else {
      setMuted(!muted);
    }
  };

  const activeNumber = manualChoice ?? detectedNumber;

  return (
    <div className="relative w-full h-[100dvh] bg-[#09140c] flex flex-col justify-between overflow-hidden select-none font-sans text-slate-100">
      {/* Background Turf & 22-Yard Pitch Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#2b6e3f_1.5px,transparent_1.5px)] [background-size:18px_18px]" />
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-72 bg-gradient-to-b from-[#7c6346]/10 via-[#274e2b]/15 to-[#7c6346]/10 pointer-events-none border-x border-[#b59975]/10" />

      {/* Top Header: Stadium Scoreboard */}
      <header className="relative z-30 flex items-center justify-between px-4 py-2.5 bg-black/75 backdrop-blur-md border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-black tracking-wider text-emerald-400 uppercase font-mono">
            ROOM: {roomCode}
          </span>
        </div>

        <div className="flex items-center gap-4 bg-emerald-950/70 px-3.5 py-1.5 rounded-full border border-emerald-500/30 shadow-inner">
          <div className="text-center">
            <span className="text-[10px] text-zinc-400 block uppercase tracking-tight font-semibold">
              Runs/Wkts
            </span>
            <span className="text-sm font-extrabold text-white leading-none font-mono">
              {score.runs}/{score.wickets}
            </span>
          </div>

          <div className="h-4 w-px bg-emerald-500/30" />

          <div className="text-center">
            <span className="text-[10px] text-zinc-400 block uppercase tracking-tight font-semibold">
              Target
            </span>
            <span className="text-sm font-extrabold text-amber-400 leading-none font-mono">
              {score.target ?? '--'}
            </span>
          </div>

          <div className="h-4 w-px bg-emerald-500/30" />

          <div className="text-center">
            <span className="text-[10px] text-zinc-400 block uppercase tracking-tight font-semibold">
              Overs
            </span>
            <span className="text-sm font-extrabold text-zinc-200 leading-none font-mono">
              {score.over}
            </span>
          </div>
        </div>
      </header>

      {/* TOP HALF: Striker's End (Opponent Feed) */}
      <div className="relative flex-1 w-full p-2.5 flex flex-col justify-end">
        <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-zinc-950 shadow-2xl">
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

          {/* 3D Wooden Stumps Graphic at Striker's End */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 opacity-80 pointer-events-none">
            {/* Horizontal Bails */}
            <div className="absolute -top-1 left-0 right-0 h-1 bg-amber-100 rounded-full shadow-sm" />
            <div className="w-2 h-7 bg-gradient-to-b from-amber-200 to-amber-700 rounded-t-sm shadow-md" />
            <div className="w-2 h-7 bg-gradient-to-b from-amber-200 to-amber-700 rounded-t-sm shadow-md" />
            <div className="w-2 h-7 bg-gradient-to-b from-amber-200 to-amber-700 rounded-t-sm shadow-md" />
          </div>

          {/* Masking Overlay during 5s Secret Delivery Countdown */}
          {phase === 'countdown' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/60 backdrop-blur-xl">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center animate-pulse mb-2 shadow-neon-green">
                <Shield className="w-7 h-7 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-emerald-200 tracking-wide font-display">
                OPPONENT IN SECRET STANCE
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5">
                Live reaction reveals at 0s delivery mark
              </span>
            </div>
          )}

          {/* Opponent Role Pill */}
          <div className="absolute bottom-2 left-2 z-10 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 shadow-lg">
            <span className="text-xs font-bold text-white">
              {!isBatting ? '🏏 Striker' : '🎾 Bowler'}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              (Opponent)
            </span>
          </div>

          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 text-zinc-500 text-xs font-mono">
              Connecting pitch video...
            </div>
          )}
        </div>

        {/* Popping Crease White Line Marking */}
        <div className="w-full flex items-center justify-between px-4 mt-1.5 pointer-events-none">
          <div className="h-0.5 w-16 bg-white/50 shadow-sm" />
          <span className="text-[9px] tracking-widest text-zinc-400 uppercase font-mono font-bold">
            POPPING CREASE
          </span>
          <div className="h-0.5 w-16 bg-white/50 shadow-sm" />
        </div>
      </div>

      {/* CENTER HUD: The Pitch Strip, Cricket Ball Timer & Big Outcome Banner */}
      <div className="relative z-30 h-16 w-full flex items-center justify-center px-4 my-1">
        {/* Pitch Turf Texture Line */}
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-11 bg-[#7c6346]/25 border-y-2 border-[#b59975]/40 rounded-xl pointer-events-none flex items-center justify-around shadow-inner">
          <div className="w-10 h-px bg-white/25 rotate-45" />
          <div className="w-10 h-px bg-white/25 -rotate-45" />
          <div className="w-10 h-px bg-white/25 rotate-45" />
        </div>

        {/* Circular Pulsing Cricket Ball with Seam Stitching */}
        <motion.div
          key={phase + timer}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-br from-red-600 via-red-700 to-red-950 border-2 border-white/90 shadow-[0_0_25px_rgba(220,38,38,0.7)] flex flex-col items-center justify-center text-white"
        >
          {/* Seam Stitching Line */}
          <div className="absolute inset-0 rounded-full border-r-2 border-dashed border-white/70 pointer-events-none" />
          <span className="text-sm font-black leading-none font-display text-glow-amber">
            {timer}s
          </span>
          <span className="text-[8px] uppercase tracking-tighter text-red-100 font-extrabold mt-0.5">
            {phase === 'countdown' ? 'LOCK' : 'BANTER'}
          </span>
        </motion.div>

        {/* Big Climax Result Popups */}
        <AnimatePresence>
          {phase === 'reveal' && lastBallResult && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className={`absolute z-40 px-6 py-2.5 rounded-2xl shadow-2xl font-black text-lg sm:text-xl flex items-center gap-2 border-2 ${
                lastBallResult.isOut
                  ? 'bg-red-600 text-white border-red-200 shadow-red-500/70 text-glow-pink'
                  : 'bg-emerald-500 text-slate-950 border-white shadow-emerald-500/70'
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
      </div>

      {/* BOTTOM HALF: Bowler's End (Local Camera Feed) */}
      <div className="relative flex-1 w-full p-2.5 flex flex-col justify-start">
        {/* Bowling Crease White Line Marking */}
        <div className="w-full flex items-center justify-between px-4 mb-1.5 pointer-events-none">
          <div className="h-0.5 w-16 bg-white/50 shadow-sm" />
          <span className="text-[9px] tracking-widest text-zinc-400 uppercase font-mono font-bold">
            BOWLING CREASE
          </span>
          <div className="h-0.5 w-16 bg-white/50 shadow-sm" />
        </div>

        <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-zinc-950 shadow-2xl">
          <video
            ref={setLocalVideoNode}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />
          {externalCanvasRef && (
            <canvas
              ref={externalCanvasRef as any}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none -scale-x-100"
            />
          )}

          {/* 3D Wooden Stumps Graphic at Bowler's End */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 opacity-80 pointer-events-none">
            <div className="w-2 h-7 bg-gradient-to-t from-amber-200 to-amber-700 rounded-b-sm shadow-md" />
            <div className="w-2 h-7 bg-gradient-to-t from-amber-200 to-amber-700 rounded-b-sm shadow-md" />
            <div className="w-2 h-7 bg-gradient-to-t from-amber-200 to-amber-700 rounded-b-sm shadow-md" />
          </div>

          {/* Live Stylized Umpire Signal Indicator */}
          <div className="absolute top-2.5 left-2.5 z-10">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border-2 backdrop-blur-md shadow-lg transition-all ${
                activeNumber
                  ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-neon-green'
                  : 'bg-black/75 border-yellow-500/50 text-yellow-300'
              }`}
            >
              <Hand className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-extrabold font-mono flex items-center gap-1">
                {activeNumber ? (
                  <>
                    <span>{NUMBER_EMOJIS[activeNumber]}</span>
                    <span>{activeNumber} RUNS</span>
                  </>
                ) : (
                  <span>Scanning Hand...</span>
                )}
              </span>
            </div>
          </div>

          {/* User Role Pill */}
          <div className="absolute bottom-2 left-2 z-10 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 shadow-lg">
            <span className="text-xs font-bold text-white">
              {isBatting ? '🏏 Striker' : '🎾 Bowler'}
            </span>
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
              (You)
            </span>
          </div>

          {/* Tap Fallback Bar Overlay (1 to 6) */}
          <div className="absolute bottom-2 right-2 z-10 flex gap-1 bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/10">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                onClick={() => onSelectManualChoice?.(num)}
                disabled={phase !== 'countdown'}
                className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center ${
                  activeNumber === num
                    ? 'bg-emerald-400 text-slate-950 font-black scale-110 shadow-md'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40'
                }`}
                title={`Select ${num} runs`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <footer className="relative z-30 px-4 py-2.5 bg-black/85 backdrop-blur-md border-t border-emerald-500/20 flex items-center gap-3">
        <button
          onClick={onLeave}
          className="p-3 rounded-xl bg-red-950/60 border border-red-500/30 text-red-400 hover:bg-red-900/60 transition-colors flex items-center justify-center"
          title="Leave Match"
        >
          <PhoneOff className="w-4 h-4" />
        </button>

        <button
          onClick={toggleMute}
          className={`p-3 rounded-xl border transition-colors flex items-center justify-center ${
            muted
              ? 'bg-red-950/60 border-red-500/40 text-red-400'
              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
          }`}
          title="Toggle Opponent Audio"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {phase === 'banter' ? (
          <button
            onClick={onNextBall}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-98 text-slate-950 font-black text-sm rounded-xl transition-all shadow-neon-green flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4 stroke-[3]" />
            NEXT DELIVERY NOW
          </button>
        ) : (
          <div className="flex-1 py-3 px-4 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center text-xs font-mono font-medium text-emerald-400 flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
            <span>
              {phase === 'countdown'
                ? `Delivery in flight! Lock your gesture... (${timer}s)`
                : 'Resolving delivery outcome...'}
            </span>
          </div>
        )}
      </footer>
    </div>
  );
};
export default HandCricketPitchArena;
