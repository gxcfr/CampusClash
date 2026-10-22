import React, { useState } from 'react';
import { Sparkles, User, Check, X } from 'lucide-react';

interface UsernameModalProps {
  isOpen: boolean;
  currentUsername: string;
  onSave: (newUsername: string) => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

const MUJ_HANDLE_SUGGESTIONS = [
  'JaipurBlaster',
  'Hostel9Boss',
  'TapriTactician',
  'DehmiKalanKing',
  'B7Coder',
  'CyberNomad',
  'PixelStriker',
  'DomeChampion',
  'ByteBowler',
];

export const UsernameModal: React.FC<UsernameModalProps> = ({
  isOpen,
  currentUsername,
  onSave,
  onClose,
  canDismiss = true,
}) => {
  const [name, setName] = useState(currentUsername || '');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a display handle');
      return;
    }
    if (trimmed.length > 15) {
      setError('Maximum 15 characters allowed');
      return;
    }
    setError('');
    onSave(trimmed);
  };

  const handlePickRandom = () => {
    const random = MUJ_HANDLE_SUGGESTIONS[Math.floor(Math.random() * MUJ_HANDLE_SUGGESTIONS.length)];
    const suffixed = `${random}_${Math.floor(10 + Math.random() * 89)}`;
    setName(suffixed);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md p-6 overflow-hidden rounded-2xl bg-arcade-card border border-arcade-border shadow-2xl">
        {/* Glow ambient accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-cyan-500/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-pink-500/20 blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between pb-3 border-b border-arcade-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-arcade-cyan border border-cyan-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white tracking-wide">
                CAMPUS IDENTITY
              </h3>
              <p className="text-xs text-slate-400">Zero database. Saved locally in browser.</p>
            </div>
          </div>
          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Choose your Gamer Handle
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                maxLength={15}
                placeholder="e.g. TapriTactician_21"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 font-medium focus:outline-none focus:border-arcade-cyan focus:ring-2 focus:ring-arcade-cyan/20 transition-all"
              />
              <span className="absolute right-3 top-3.5 text-xs text-slate-500">
                {name.length}/15
              </span>
            </div>
            {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
          </div>

          <div>
            <button
              type="button"
              onClick={handlePickRandom}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 hover:text-arcade-cyan border border-slate-700 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Generate Random MUJ Nickname
            </button>
          </div>

          <div className="pt-2 flex gap-3">
            {canDismiss && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-arcade-cyan to-blue-500 hover:from-cyan-400 hover:to-blue-400 shadow-neon-cyan flex items-center justify-center gap-2 transition-all"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Confirm Handle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
