import React, { useState } from 'react';
import {
  Gamepad2,
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
  Trophy,
  Flame,
  Hand,
  CheckCircle2,
} from 'lucide-react';
import { UsernameModal } from './UsernameModal';
import type { CameraMode } from '../types/game';

interface MainLobbyProps {
  username: string;
  onUpdateUsername: (newUsername: string) => void;
  onSelectGame: (gameId: string, cameraMode?: CameraMode) => void;
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
}

export const MainLobby: React.FC<MainLobbyProps> = ({
  username,
  onUpdateUsername,
  onSelectGame,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [activeHandCricketMode, setActiveHandCricketMode] = useState<CameraMode>('camera');

  const gameTiles: GameTile[] = [
    {
      id: 'hand-cricket',
      title: 'Hand Cricket 1v1',
      description:
        'Street-style hand cricket! Pick your numbers (1-6), guess your opponent’s move, avoid the wicket, and catch their live face reaction.',
      badge: 'LIVE / PLAY NOW',
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      isLive: true,
      playerTag: '1v1 Duel',
      icon: (
        <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-md">
          <Hand className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-[#151a26]" />
        </div>
      ),
      category: 'Campus Classic',
    },
    {
      id: 'quiz-battle',
      title: 'Campus Quiz Battle',
      description:
        'MUJ lore, faculty banter, Jaipur trivia & hostel survival hacks. Fast buzzers, rapid points, campus pride.',
      badge: 'COMING SOON',
      badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      isLive: false,
      playerTag: '2-8 Players',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-400">
          <BrainCircuit className="w-6 h-6" />
        </div>
      ),
      category: 'Trivia & Lore',
    },
    {
      id: 'speed-typing',
      title: 'Speed Typing Race',
      description:
        'Clash raw WPM against fellow engineers on real campus code snippets, buggy syntax, and lab memes.',
      badge: 'COMING SOON',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      isLive: false,
      playerTag: '1v1 or Free-For-All',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-400">
          <Code2 className="w-6 h-6" />
        </div>
      ),
      category: 'Keyboard Dexterity',
    },
    {
      id: 'reaction-duel',
      title: 'Tapri Reaction Duel',
      description:
        'Millisecond precision shootout. First to release when the tapri chai boils wins eternal hostel bragging rights.',
      badge: 'COMING SOON',
      badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      isLive: false,
      playerTag: '1v1 Duel',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-400">
          <Coffee className="w-6 h-6" />
        </div>
      ),
      category: 'Reflexes',
    },
    {
      id: 'draw-guess',
      title: 'Draw & Guess',
      description:
        'Skribbl-style party game tuned for roomies. Doodle campus landmarks, mess food, and inside college jokes.',
      badge: 'COMING SOON',
      badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      isLive: false,
      playerTag: '3-10 Party',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-950/40 border border-blue-800/40 text-blue-400">
          <Pencil className="w-6 h-6" />
        </div>
      ),
      category: 'Party Drawing',
    },
    {
      id: 'tictactoe-blitz',
      title: 'Tic-Tac-Toe Blitz',
      description:
        '30-second rapid-fire grid with disappearing marks and rapid campus power-up tiles.',
      badge: 'COMING SOON',
      badgeColor: 'bg-zinc-700/30 text-zinc-400 border-zinc-700/50',
      isLive: false,
      playerTag: '1v1 Duel',
      icon: (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 text-zinc-400">
          <Grid3X3 className="w-6 h-6" />
        </div>
      ),
      category: 'Speed Grid',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0e121a] flex flex-col text-slate-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 w-full border-b border-zinc-800/80 bg-[#0e121a]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Campus Tag */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-[#121622] rounded-[14px] flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-xl sm:text-2xl tracking-wide text-white">
                  CAMPUSCLASH
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  MUJ
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium hidden sm:block">
                Manipal University Jaipur • Student Arcade
              </p>
            </div>
          </div>

          {/* User Profile & How It Works */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 transition-all"
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>How To Play</span>
            </button>

            {/* Profile Pill */}
            <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-1.5 rounded-2xl bg-[#151a26] border border-zinc-800 shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400">
                  Student Gamer
                </span>
                <span className="text-xs sm:text-sm font-bold text-white font-mono">
                  {username || 'GuestPlayer'}
                </span>
              </div>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="ml-1 p-1.5 rounded-xl text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                title="Edit username"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-10">
        {/* Friendly Campus Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#161c28] via-[#121622] to-[#0e121a] border border-zinc-800/90 p-6 sm:p-10 shadow-xl">
          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Trophy className="w-4 h-4" />
              Hostel Street Cricket & Campus Mini-Games
            </div>

            <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Instant 1v1 Campus Battles. <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
                Play With or Without Camera.
              </span>
            </h2>

            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
              <span className="text-white font-semibold">Zero downloads. Zero logins. Zero ads.</span>{' '}
              Built for hostel rooms, mess queues, and tapri chai breaks at Manipal University Jaipur.
            </p>

            {/* Feature Pills */}
            <div className="pt-2 flex flex-wrap gap-2.5 sm:gap-3 text-xs text-zinc-300">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Camera Face Reactions & AI Hand Recognition</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <Hand className="w-4 h-4 text-amber-400" />
                <span>Touch Keypad Mode (Play Without Camera)</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Instant 1v1 Room Codes & Queue</span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Drawer */}
        {showHowItWorks && (
          <section className="p-6 rounded-3xl bg-[#141926] border border-emerald-500/30 shadow-lg space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                HOW HAND CRICKET 1v1 WORKS
              </h3>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-zinc-800"
              >
                Dismiss
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-300">
              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800">
                  Phase 1 (5s)
                </span>
                <h4 className="font-bold text-white text-sm">The Secret Delivery</h4>
                <p className="leading-relaxed">
                  Both players choose numbers 1-6 in secret. Either hold up fingers to your camera or tap numbers 1-6 on the touch keypad! Opponent feed is hidden until delivery.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-teal-400 bg-teal-950/60 border border-teal-800">
                  Phase 2 (0s)
                </span>
                <h4 className="font-bold text-white text-sm">The Instant Reveal</h4>
                <p className="leading-relaxed">
                  At 0s, both moves are revealed! If batsman matches bowler, it is OUT / WICKET! Otherwise, batsman scores runs. Video unblurs and unmutes for the live reaction!
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800">
                  Phase 3 (10s)
                </span>
                <h4 className="font-bold text-white text-sm">The Banter Window</h4>
                <p className="leading-relaxed">
                  Celebrate, tease, or discuss tactics for up to 10 seconds. Click "Next Delivery" anytime to immediately launch the next ball!
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Campus Game Matrix */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-extrabold text-2xl text-white tracking-wide flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                CAMPUS GAME MATRIX
              </h3>
              <p className="text-xs text-zinc-400">
                Select a game to start playing or create a party room with your friends.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
              1 Live / 5 In Development
            </span>
          </div>

          {/* Grid of Game Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {gameTiles.map((game) => (
              <div
                key={game.id}
                className={`relative rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between border ${
                  game.isLive
                    ? 'bg-[#151a26] border-zinc-800 hover:border-emerald-500/60 hover:shadow-xl'
                    : 'bg-[#121622]/60 border-zinc-800/60 opacity-70 cursor-not-allowed'
                }`}
              >
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
                      <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1 font-mono">
                        <Users className="w-3.5 h-3.5 text-zinc-500" />
                        {game.playerTag}
                      </span>
                    </div>
                  </div>

                  {/* Title and Category */}
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                      {game.category}
                    </span>
                    <h4 className="font-display text-xl font-bold text-white mt-0.5">
                      {game.title}
                    </h4>
                    <p className="mt-2 text-xs text-zinc-300 line-clamp-3 leading-relaxed">
                      {game.description}
                    </p>
                  </div>

                  {/* Hand Cricket specific mode selector */}
                  {game.isLive && (
                    <div className="pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                        Choose Mode:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setActiveHandCricketMode('camera')}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                            activeHandCricketMode === 'camera'
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          With Camera
                        </button>
                        <button
                          onClick={() => setActiveHandCricketMode('no-camera')}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                            activeHandCricketMode === 'no-camera'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Hand className="w-3.5 h-3.5" />
                          Without Camera
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                  {game.isLive ? (
                    <>
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                        Online & Ready
                      </span>
                      <button
                        onClick={() => onSelectGame(game.id, activeHandCricketMode)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Enter Match
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        Under Campus Test
                      </span>
                      <span className="text-[11px] font-medium text-zinc-500">Milestone 2</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer & Campus Credits with Version v0.6 */}
        <footer className="pt-10 pb-8 border-t border-zinc-800/70 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>CampusClash MUJ — Crafted for Manipal University Jaipur Students</span>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span>Direct P2P Mesh</span>
            <span>•</span>
            <span>Zero Cloud Bills</span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 font-bold border border-zinc-700/80">
              v0.6
            </span>
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
