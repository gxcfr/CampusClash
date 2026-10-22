import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { MainLobby } from './components/MainLobby';
import { HandCricketArena } from './components/HandCricketArena';
import { UsernameModal } from './components/UsernameModal';
import { PeerGameAdapter } from './services/peerManager';

export const App: React.FC = () => {
  // Pure Guest Auth in localStorage
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('campusclash_guest_username') || '';
  });
  const [isFirstEntryPromptOpen, setIsFirstEntryPromptOpen] = useState(false);

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

  // Connect to Authoritative Signaling
  useEffect(() => {
    const customServer = (import.meta as any).env?.VITE_SERVER_URL;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (customServer || isLocal) {
      const serverUrl = customServer || 'http://localhost:3001';
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 3000,
      });

      socket.on('connect', () => {
        setGameChannel(socket);
      });

      socket.on('connect_error', () => {
        // Fallback to serverless PeerGameAdapter if local server isn't running or blocked
        if (!gameChannel) {
          const peerAdapter = new PeerGameAdapter();
          setGameChannel(peerAdapter);
        }
      });

      return () => {
        socket.disconnect();
      };
    } else {
      // Deployed on Vercel / Cloud: Use PeerJS Zero-Cost P2P Mesh
      const peerAdapter = new PeerGameAdapter();
      setGameChannel(peerAdapter);

      return () => {
        peerAdapter.disconnect();
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
    <div className="min-h-screen bg-arcade-bg text-slate-100">
      {/* Route matching */}
      {currentPath.startsWith('/games/hand-cricket') ? (
        <HandCricketArena
          socket={gameChannel}
          username={username || 'GuestPlayer'}
          onLeaveArena={() => navigateTo('/')}
        />
      ) : (
        <MainLobby
          username={username}
          onUpdateUsername={handleUpdateUsername}
          onSelectGame={(gameId) => {
            if (gameId === 'hand-cricket') {
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
