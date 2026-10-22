import React, { useState } from 'react';
import {
  Gamepad2,
  Zap,
  Flame,
  Camera,
  Users,
  ShieldCheck,
  Edit3,
  HelpCircle,
  Play,
  Lock,
  Sparkles,
  Coffee,
  Code2,
  BrainCircuit,
  Pencil,
  Grid3X3,
  ExternalLink,
} from 'lucide-react';
import { UsernameModal } from './UsernameModal';

interface MainLobbyProps {
  username: string;
  onUpdateUsername: (newUsername: string) => void;
  onSelectGame: (gameId: string) => void;
}

interface GameTile {
  id: string;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  isLive: boolean;
  playerTag: string;
  icon: React.ReactNode;
  category: string;
  glowColor: string;
}

export const MainLobby: React.FC<MainLobbyProps> = ({
  username,
  onUpdateUsername,
  onSelectGame,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const gameTiles: GameTile[] = [
    {
      id: 'hand-cricket',
      title: 'Hand Cricket 1v1',
      description:
        'Camera-powered hand cricket. Guess the number, avoid the wicket, and reveal your opponent’s live reaction!',
      badge: 'LIVE / PLAY NOW',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      isLive: true,
      playerTag: '1v1 Duel',
      icon: (
        <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 shadow-neon-cyan">
          <Camera className="w-6 h-6 text-white animate-pulse" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
        </div>
      ),
      category: 'Edge Computer Vision',
      glowColor: 'group-hover:border-cyan-400/80 group-hover:shadow-neon-cyan',
    },
    {
      id: 'quiz-battle',
      title: 'Campus Quiz Battle',
      description:
        'MUJ lore, faculty banter, Jaipur trivia & hostel surviving hacks. Fast buzzers, rapid points.',
      badge: 'COMING SOON',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      isLive: false,
      playerTag: '2-8 Players',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-900/40 border border-purple-500/30 text-purple-400">
          <BrainCircuit className="w-6 h-6" />
        </div>
      ),
      category: 'Trivia & Lore',
      glowColor: '',
    },
    {
      id: 'speed-typing',
      title: 'Speed Typing Race',
      description:
        'Clash your raw WPM against fellow campus engineers on messy code snippets and engineering memes.',
      badge: 'COMING SOON',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      isLive: false,
      playerTag: '1v1 or Free-For-All',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-900/40 border border-amber-500/30 text-amber-400">
          <Code2 className="w-6 h-6" />
        </div>
      ),
      category: 'Dexterity',
      glowColor: '',
    },
    {
      id: 'reaction-duel',
      title: 'Reaction Time Duel',
      description:
        'Millisecond precision shootout. First to release when the tapri chai boils wins eternal bragging rights.',
      badge: 'COMING SOON',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      isLive: false,
      playerTag: '1v1 Duel',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-rose-900/40 border border-rose-500/30 text-rose-400">
          <Coffee className="w-6 h-6" />
        </div>
      ),
      category: 'Reflexes',
      glowColor: '',
    },
    {
      id: 'draw-guess',
      title: 'Draw & Guess',
      description:
        'Skribbl-style party game tuned for your roomies. Doodle campus landmarks and guess inside jokes.',
      badge: 'COMING SOON',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      isLive: false,
      playerTag: '3-10 Party',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-900/40 border border-blue-500/30 text-blue-400">
          <Pencil className="w-6 h-6" />
        </div>
      ),
      category: 'Party Game',
      glowColor: '',
    },
    {
      id: 'tictactoe-blitz',
      title: 'Tic-Tac-Toe Blitz',
      description:
        '30-second hyper-speed grid with disappearing marks and rapid-fire campus power-ups.',
      badge: 'COMING SOON',
      badgeColor: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
      isLive: false,
      playerTag: '1v1 Duel',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 text-slate-400">
          <Grid3X3 className="w-6 h-6" />
        </div>
      ),
      category: 'Speed Grid',
      glowColor: '',
    },
  ];

  return (
    <div className="min-h-screen bg-arcade-bg bg-arcade-grid flex flex-col text-slate-100">
      {/* Top Navigation Bar & Identity */}
      <header className="sticky top-0 z-30 w-full border-b border-arcade-border/80 bg-arcade-bg/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Campus Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-arcade-cyan via-blue-600 to-arcade-neonPink p-0.5 shadow-neon-cyan">
              <div className="w-full h-full bg-[#0d0f18] rounded-[10px] flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-arcade-cyan animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-xl sm:text-2xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-arcade-cyan via-white to-arcade-neonPink">
                  CAMPUSCLASH
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-arcade-neonPink/20 text-arcade-neonPink border border-arcade-neonPink/40">
                  MUJ
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Manipal University Jaipur • Arcade Platform
              </p>
            </div>
          </div>

          {/* Guest Profile Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5 text-arcade-cyan" />
              <span>How It Works</span>
            </button>

            {/* Profile Pill */}
            <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-arcade-card border border-arcade-border shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Guest Gamer
                </span>
                <span className="text-xs sm:text-sm font-bold text-white font-mono">
                  {username || 'GuestPlayer'}
                </span>
              </div>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-arcade-cyan hover:bg-slate-800/80 transition-colors"
                title="Edit username"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero / Platform Introduction */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-10">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-arcade-card via-[#111322] to-[#0d0f1b] border border-arcade-border p-6 sm:p-10 shadow-2xl">
          {/* Ambient blur spheres */}
          <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-arcade-cyan/10 text-arcade-cyan border border-arcade-cyan/30">
              <Zap className="w-3.5 h-3.5" />
              Milestone 1 — Zero-Cost Architecture
            </div>

            <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Instant-Play Campus Battles <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-cyan via-teal-300 to-emerald-400">
                Powered by Edge Vision.
              </span>
            </h2>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
              <span className="text-white font-semibold">Zero downloads. Zero logins.</span> Hyper-local
              mini-games designed for hostel breaks, mess queues, and tapri chai banter at MUJ.
            </p>

            {/* Architecture Highlights Pill Row */}
            <div className="pt-2 flex flex-wrap gap-2.5 sm:gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/80">
                <Camera className="w-3.5 h-3.5 text-arcade-cyan" />
                <span>Edge WebAssembly Hand Tracking</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/80">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>P2P Direct WebRTC Mesh</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/80">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Authoritative Anti-Cheat State</span>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works Collapsible Drawer */}
        {showHowItWorks && (
          <section className="p-6 rounded-2xl bg-arcade-card/90 border border-cyan-500/30 shadow-lg space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-arcade-cyan flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                HOW HAND CRICKET 1v1 WORKS
              </h3>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-arcade-cyan bg-cyan-950/60 border border-cyan-800">
                  Phase 1 (5s)
                </span>
                <h4 className="font-bold text-white">The Secret Delivery</h4>
                <p>
                  Both cameras turn on, but your opponent's video is completely blurred and audio muted. In the final 2s, hold up your fingers (1-5 runs, fist/thumb = 6). Edge AI locks it in!
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800">
                  Phase 2 (0s)
                </span>
                <h4 className="font-bold text-white">The Instant Reveal</h4>
                <p>
                  At 0s, choices reveal! If batsman matches bowler, it is OUT / WICKET! Otherwise, batsman scores runs. Video unblurs and audio unmutes instantly to see reactions!
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800">
                  Phase 3 (10s)
                </span>
                <h4 className="font-bold text-white">Banter Window</h4>
                <p>
                  Celebrate, tease your friend, or discuss tactics for up to 10 seconds. Click "Next Ball" anytime to immediately launch the next delivery!
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Interactive Game Matrix Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-extrabold text-2xl text-white tracking-wide flex items-center gap-2">
                <Flame className="w-6 h-6 text-arcade-neonPink" />
                CAMPUS GAME MATRIX
              </h3>
              <p className="text-xs text-slate-400">
                Select a game to enter matchmaking or generate a custom party room.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              1 Active / 5 In Development
            </span>
          </div>

          {/* Grid of Game Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-3">
            {gameTiles.map((game) => (
              <div
                key={game.id}
                onClick={() => game.isLive && onSelectGame(game.id)}
                className={`group relative rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden border ${
                  game.isLive
                    ? 'cursor-pointer bg-gradient-to-b from-arcade-card to-[#101322] border-slate-700/80 hover:-translate-y-1.5 hover:border-arcade-cyan hover:shadow-neon-cyan'
                    : 'cursor-not-allowed bg-slate-900/40 border-slate-800/80 opacity-70'
                }`}
              >
                {/* Active tile glow corner */}
                {game.isLive && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-arcade-cyan/10 rounded-full blur-2xl pointer-events-none group-hover:bg-arcade-cyan/20 transition-all" />
                )}

                <div className="space-y-4">
                  {/* Top card row: Icon + Badges */}
                  <div className="flex items-start justify-between">
                    {game.icon}
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${game.badgeColor}`}
                      >
                        {game.badge}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 font-mono">
                        <Users className="w-3 h-3 text-slate-500" />
                        {game.playerTag}
                      </span>
                    </div>
                  </div>

                  {/* Title and Category */}
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-arcade-cyan">
                      {game.category}
                    </span>
                    <h4 className="font-display text-xl font-bold text-white group-hover:text-arcade-cyan transition-colors">
                      {game.title}
                    </h4>
                    <p className="mt-2 text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {game.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  {game.isLive ? (
                    <>
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                        Online & Ready
                      </span>
                      <button className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-arcade-cyan to-emerald-400 group-hover:from-cyan-300 group-hover:to-emerald-300 flex items-center gap-1.5 shadow-md transition-all">
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Launch 1v1
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Under Campus Test
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">Milestone 2</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer & Campus Credits */}
        <footer className="pt-10 pb-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-arcade-neonPink" />
            <span>CampusClash MUJ — Crafted for Manipal University Jaipur Students</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Client-side WebAssembly CV</span>
            <span>•</span>
            <span>Direct Mesh WebRTC</span>
            <span>•</span>
            <span>Zero Server Cloud Bills</span>
          </div>
        </footer>
      </main>

      {/* Username Edit Modal */}
      <UsernameModal
        isOpen={isEditModalOpen}
        currentUsername={username}
        onSave={(newName) => {
          onUpdateUsername(newName);
          setIsEditModalOpen(false);
        }}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
};
