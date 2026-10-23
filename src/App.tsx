import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { MainLobby } from './components/MainLobby';
import { HandCricketArena } from './components/HandCricketArena';
import { UsernameModal } from './components/UsernameModal';
import { PeerGameAdapter } from './services/peerManager';
import type { CameraMode } from './types/game';

export const App: React.FC = () => {
  // Pure Guest Auth in localStorage
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('campusclash_guest_username') || '';
  });
  const [isFirstEntryPromptOpen, setIsFirstEntryPromptOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('camera');

  // Simple client routing ('/' vs '/games/hand-cricket')
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const [gameChannel, setGameChannel] = useState<any>(null);

  // Initialize guest username or open first entry modal
  useEffect(() => {
    if (!username) {
      setIsFirstEntryPromptOpen(true);
    }
  }, [username]);

  // Connect to Authoritative Signaling or Fallback to P2P Mesh
  useEffect(() => {
    let active = true;
    const customServer = (import.meta as any).env?.VITE_SERVER_URL;
    const hostname = window.location.hostname;
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.');

    let activeSocket: Socket | null = null;
    let peerAdapter: PeerGameAdapter | null = null;
    let hasFallback = false;

    if (customServer || isLocal) {
      const serverPort = 3001;
      const serverUrl = customServer || `http://${hostname || 'localhost'}:${serverPort}`;

      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 2000,
        reconnectionAttempts: 1,
      });
      activeSocket = socket;

      socket.on('connect', () => {
        if (!active) return;
        setGameChannel(socket);
      });

      socket.on('connect_error', () => {
        if (!active || hasFallback) return;
        hasFallback = true;
        try {
          socket.disconnect();
        } catch (e) {}

        peerAdapter = new PeerGameAdapter();
        setGameChannel(peerAdapter);
      });

      return () => {
        active = false;
        if (activeSocket) activeSocket.disconnect();
        if (peerAdapter) peerAdapter.disconnect();
      };
    } else {
      peerAdapter = new PeerGameAdapter();
      setGameChannel(peerAdapter);

      return () => {
        active = false;
        if (peerAdapter) peerAdapter.disconnect();
      };
    }
  }, []);

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleUpdateUsername = (newName: string) => {
    localStorage.setItem('campusclash_guest_username', newName);
    setUsername(newName);
    setIsFirstEntryPromptOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0e121a] text-slate-100">
      {/* Route matching */}
      {currentPath.startsWith('/games/hand-cricket') ? (
        <HandCricketArena
          socket={gameChannel}
          username={username || 'GuestPlayer'}
          onLeaveArena={() => navigateTo('/')}
          initialCameraMode={cameraMode}
        />
      ) : (
        <MainLobby
          username={username}
          onUpdateUsername={handleUpdateUsername}
          onSelectGame={(gameId, mode) => {
            if (gameId === 'hand-cricket') {
              if (mode) setCameraMode(mode);
              navigateTo('/games/hand-cricket');
            }
          }}
        />
      )}

      {/* First entry welcome handle modal */}
      <UsernameModal
        isOpen={isFirstEntryPromptOpen}
        currentUsername={username}
        onSave={handleUpdateUsername}
        canDismiss={Boolean(username)}
      />
    </div>
  );
};

export default App;
