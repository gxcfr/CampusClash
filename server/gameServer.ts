import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// --------------------------------------------------------------------------
// TYPES & IN-MEMORY GAME STATE
// --------------------------------------------------------------------------
type GamePhase =
  | 'LOBBY'
  | 'MATCHMAKING'
  | 'PHASE_1_COUNTDOWN'  // 5s Secret Delivery
  | 'PHASE_2_REVEAL'     // Reveal & State Resolution
  | 'PHASE_3_BANTER'     // Max 10s Banter Window
  | 'INNING_TRANSITION'  // Switch Batsman & Bowler
  | 'GAME_OVER';

type PlayerRole = 'batsman' | 'bowler' | 'spectator';

interface Player {
  id: string;
  username: string;
  role: PlayerRole;
  isHost: boolean;
  score: number;
  wickets: number;
  currentChoice: number | null;
  hasLockedIn: boolean;
  avatarSeed: string;
}

interface BallResult {
  ballNumber: number;
  batsmanChoice: number;
  bowlerChoice: number;
  isWicket: boolean;
  runsScored: number;
  commentary: string;
  timestamp: number;
}

interface Room {
  roomId: string;
  mode: 'party' | 'quick';
  cameraMode: 'camera' | 'no-camera';
  phase: GamePhase;
  phaseSecondsRemaining: number;
  players: Record<string, Player>;
  currentInning: 1 | 2;
  maxOvers: number;
  totalBallsPerInning: number;
  currentBallsBowled: number;
  currentInningRuns: number;
  currentInningWickets: number;
  maxWicketsPerInning: number;
  targetRuns: number | null;
  ballHistory: BallResult[];
  lastBallResult: BallResult | null;
  winnerId: string | null;
  winMessage: string | null;

  // Active Phase Timer
  phaseInterval?: NodeJS.Timeout;
}

const rooms: Record<string, Room> = {};
const quickMatchQueue: string[] = []; // Socket IDs waiting for quick match

// Helper: Generate unique 4-character Room Code (e.g. MUJ9, JAIP, etc.)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms[code] ? generateRoomCode() : code;
}

// --------------------------------------------------------------------------
// AUTHORITATIVE GAME STATE MACHINE
// --------------------------------------------------------------------------
function broadcastRoom(room: Room) {
  // Strip non-serializable interval before emitting
  const { phaseInterval, ...safeRoom } = room;
  io.to(room.roomId).emit('room_update', safeRoom);
}

function clearRoomTimer(room: Room) {
  if (room.phaseInterval) {
    clearInterval(room.phaseInterval);
    room.phaseInterval = undefined;
  }
}

/**
 * Phase 1: 5-Second Secret Delivery Countdown
 */
function startPhase1SecretDelivery(room: Room) {
  clearRoomTimer(room);

  room.phase = 'PHASE_1_COUNTDOWN';
  room.phaseSecondsRemaining = 5;

  // Reset player choices for this ball (auto-assign bot choice)
  for (const p of Object.values(room.players)) {
    if (p.id.startsWith('bot_')) {
      const botRoll = [1, 2, 2, 3, 4, 4, 5, 6, 6];
      p.currentChoice = botRoll[Math.floor(Math.random() * botRoll.length)];
      p.hasLockedIn = true;
    } else {
      p.currentChoice = null;
      p.hasLockedIn = false;
    }
  }

  broadcastRoom(room);

  room.phaseInterval = setInterval(() => {
    room.phaseSecondsRemaining -= 1;
    io.to(room.roomId).emit('countdown_tick', { seconds: room.phaseSecondsRemaining });

    if (room.phaseSecondsRemaining <= 0) {
      clearRoomTimer(room);
      resolveBall(room);
    }
  }, 1000);
}

/**
 * Phase 2: Reveal & State Resolution
 */
function resolveBall(room: Room) {
  clearRoomTimer(room);

  room.phase = 'PHASE_2_REVEAL';

  const batsman = Object.values(room.players).find((p) => p.role === 'batsman');
  const bowler = Object.values(room.players).find((p) => p.role === 'bowler');

  // Anti-Cheat Fallback: If a client failed to emit choice, auto-resolve with random 1..6
  if (batsman && batsman.currentChoice === null) {
    batsman.currentChoice = Math.floor(Math.random() * 6) + 1;
  }
  if (bowler && bowler.currentChoice === null) {
    bowler.currentChoice = Math.floor(Math.random() * 6) + 1;
  }

  const batsmanChoice = batsman?.currentChoice || 1;
  const bowlerChoice = bowler?.currentChoice || 1;

  room.currentBallsBowled += 1;
  const isWicket = batsmanChoice === bowlerChoice;
  const runsScored = isWicket ? 0 : batsmanChoice;

  let commentary = '';
  if (isWicket) {
    room.currentInningWickets += 1;
    commentary = `OUT! Clean bowled! Both chose ${batsmanChoice}!`;
  } else {
    room.currentInningRuns += runsScored;
    if (runsScored === 6) {
      commentary = `MAXIMUM! Smashed over the Dehmi Kalan hostel for SIX!`;
    } else if (runsScored === 4) {
      commentary = `BOUNDARY! Raced away to the tapri fence for FOUR!`;
    } else {
      commentary = `Pushed into the gap for ${runsScored} run${runsScored > 1 ? 's' : ''}.`;
    }
  }

  const ballResult: BallResult = {
    ballNumber: room.currentBallsBowled,
    batsmanChoice,
    bowlerChoice,
    isWicket,
    runsScored,
    commentary,
    timestamp: Date.now(),
  };

  room.lastBallResult = ballResult;
  room.ballHistory.push(ballResult);

  io.to(room.roomId).emit('ball_resolved', ballResult);
  broadcastRoom(room);

  // Check Inning Transitions or Match Win
  setTimeout(() => {
    checkMatchProgress(room);
  }, 2500);
}

/**
 * Check Inning Completion & Game Over Rules
 */
function checkMatchProgress(room: Room) {
  const isInningOver =
    room.currentInningWickets >= room.maxWicketsPerInning ||
    room.currentBallsBowled >= room.totalBallsPerInning;

  // 1. If 2nd Inning: Check if target is chased or inning finished
  if (room.currentInning === 2 && room.targetRuns !== null) {
    const chasingPlayer = Object.values(room.players).find((p) => p.role === 'batsman');
    const defendingPlayer = Object.values(room.players).find((p) => p.role === 'bowler');

    // Chased down target!
    if (room.currentInningRuns >= room.targetRuns) {
      room.phase = 'GAME_OVER';
      room.winnerId = chasingPlayer?.id || null;
      room.winMessage = `${chasingPlayer?.username} chased down the target of ${room.targetRuns} runs! 🏆`;
      broadcastRoom(room);
      io.to(room.roomId).emit('game_over', { winnerId: room.winnerId });
      return;
    }

    // Inning finished and failed to chase target
    if (isInningOver) {
      room.phase = 'GAME_OVER';
      if (room.currentInningRuns === room.targetRuns - 1) {
        // Tie
        room.winnerId = null;
        room.winMessage = `Scores level at ${room.currentInningRuns}! Match Tied! 🤝`;
      } else {
        room.winnerId = defendingPlayer?.id || null;
        room.winMessage = `${defendingPlayer?.username} defended the target by ${
          room.targetRuns - 1 - room.currentInningRuns
        } runs! 🏆`;
      }
      broadcastRoom(room);
      io.to(room.roomId).emit('game_over', { winnerId: room.winnerId });
      return;
    }
  }

  // 2. If 1st Inning finished: Transition to 2nd Inning
  if (room.currentInning === 1 && isInningOver) {
    room.currentInning = 2;
    room.targetRuns = room.currentInningRuns + 1;
    room.currentBallsBowled = 0;
    room.currentInningRuns = 0;
    room.currentInningWickets = 0;
    room.phase = 'INNING_TRANSITION';

    // Swap Batsman and Bowler roles
    for (const p of Object.values(room.players)) {
      p.role = p.role === 'batsman' ? 'bowler' : 'batsman';
      p.currentChoice = null;
      p.hasLockedIn = false;
    }

    broadcastRoom(room);
    return;
  }

  // 3. Otherwise: Enter Phase 3 Banter Window
  startPhase3Banter(room);
}

/**
 * Phase 3: Banter Window (Max 10s)
 */
function startPhase3Banter(room: Room) {
  clearRoomTimer(room);

  room.phase = 'PHASE_3_BANTER';
  room.phaseSecondsRemaining = 10;
  broadcastRoom(room);

  room.phaseInterval = setInterval(() => {
    room.phaseSecondsRemaining -= 1;
    io.to(room.roomId).emit('countdown_tick', { seconds: room.phaseSecondsRemaining });

    if (room.phaseSecondsRemaining <= 0) {
      clearRoomTimer(room);
      startPhase1SecretDelivery(room);
    }
  }, 1000);
}

// --------------------------------------------------------------------------
// SOCKET.IO EVENT HANDLERS
// --------------------------------------------------------------------------
io.on('connection', (socket: Socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // 1. Create Party Room
  socket.on('create_room', ({ username, cameraMode }: { username: string; cameraMode?: 'camera' | 'no-camera' }) => {
    const roomId = generateRoomCode();
    socket.join(roomId);

    const room: Room = {
      roomId,
      mode: 'party',
      cameraMode: cameraMode || 'camera',
      phase: 'LOBBY',
      phaseSecondsRemaining: 0,
      players: {
        [socket.id]: {
          id: socket.id,
          username: username || 'Player 1',
          role: 'batsman',
          isHost: true,
          score: 0,
          wickets: 0,
          currentChoice: null,
          hasLockedIn: false,
          avatarSeed: socket.id,
        },
      },
      currentInning: 1,
      maxOvers: 2,
      totalBallsPerInning: 12, // 2 overs of 6 balls
      currentBallsBowled: 0,
      currentInningRuns: 0,
      currentInningWickets: 0,
      maxWicketsPerInning: 2, // 2 wickets per inning in 1v1
      targetRuns: null,
      ballHistory: [],
      lastBallResult: null,
      winnerId: null,
      winMessage: null,
    };

    rooms[roomId] = room;
    broadcastRoom(room);
    console.log(`[Room Created] Code: ${roomId} by ${username} (Mode: ${room.cameraMode})`);
  });

  // 2. Join Party Room
  socket.on('join_room', ({ roomId, username }: { roomId: string; username: string }) => {
    const cleanRoomId = roomId ? roomId.trim().toUpperCase() : '';
    const room = rooms[cleanRoomId];

    if (!room) {
      socket.emit('game_error', { message: 'Invalid Room Code. Please check the 4-letter code and retry.' });
      return;
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= 2 && !room.players[socket.id]) {
      socket.emit('game_error', { message: 'Room is already full with 2 players.' });
      return;
    }

    socket.join(room.roomId);

    room.players[socket.id] = {
      id: socket.id,
      username: username || 'Player 2',
      role: 'bowler',
      isHost: false,
      score: 0,
      wickets: 0,
      currentChoice: null,
      hasLockedIn: false,
      avatarSeed: socket.id,
    };

    broadcastRoom(room);
    socket.emit('room_update', room);

    // Notify peers to prepare WebRTC mesh
    io.to(room.roomId).emit('peer_ready', { roomId: room.roomId });
    console.log(`[Player Joined] ${username} entered Room ${room.roomId}`);
  });

  // 3. Quick Match Queue
  socket.on('quick_match', ({ username, cameraMode }: { username: string; cameraMode?: 'camera' | 'no-camera' }) => {
    const desiredMode = cameraMode || 'camera';
    // If waiting opponent in queue
    if (quickMatchQueue.length > 0) {
      const opponentSocketId = quickMatchQueue.shift()!;
      const opponentSocket = io.sockets.sockets.get(opponentSocketId);

      if (opponentSocket && opponentSocket.connected) {
        const roomId = generateRoomCode();
        socket.join(roomId);
        opponentSocket.join(roomId);

        const room: Room = {
          roomId,
          mode: 'quick',
          cameraMode: desiredMode,
          phase: 'LOBBY',
          phaseSecondsRemaining: 0,
          players: {
            [opponentSocketId]: {
              id: opponentSocketId,
              username: (opponentSocket as any)._queuedUsername || 'Challenger 1',
              role: 'batsman',
              isHost: true,
              score: 0,
              wickets: 0,
              currentChoice: null,
              hasLockedIn: false,
              avatarSeed: opponentSocketId,
            },
            [socket.id]: {
              id: socket.id,
              username: username || 'Challenger 2',
              role: 'bowler',
              isHost: false,
              score: 0,
              wickets: 0,
              currentChoice: null,
              hasLockedIn: false,
              avatarSeed: socket.id,
            },
          },
          currentInning: 1,
          maxOvers: 2,
          totalBallsPerInning: 12,
          currentBallsBowled: 0,
          currentInningRuns: 0,
          currentInningWickets: 0,
          maxWicketsPerInning: 2,
          targetRuns: null,
          ballHistory: [],
          lastBallResult: null,
          winnerId: null,
          winMessage: null,
        };

        rooms[roomId] = room;
        broadcastRoom(room);
        io.to(roomId).emit('peer_ready', { roomId });
        return;
      }
    }

    // Push into queue
    (socket as any)._queuedUsername = username || 'Challenger';
    quickMatchQueue.push(socket.id);
    socket.emit('room_update', {
      roomId: 'QUEUE',
      mode: 'quick',
      cameraMode: desiredMode,
      phase: 'MATCHMAKING',
      phaseSecondsRemaining: 0,
      players: {},
      currentInning: 1,
      maxOvers: 2,
      totalBallsPerInning: 12,
      currentBallsBowled: 0,
      currentInningRuns: 0,
      currentInningWickets: 0,
      targetRuns: null,
      ballHistory: [],
      lastBallResult: null,
      winnerId: null,
      winMessage: null,
    });
  });

  // 3b. Start Bot Match
  socket.on('start_bot_match', ({ username, cameraMode }: { username: string; cameraMode?: 'camera' | 'no-camera' }) => {
    // Remove from quickMatchQueue if queued
    const qIdx = quickMatchQueue.indexOf(socket.id);
    if (qIdx !== -1) quickMatchQueue.splice(qIdx, 1);

    const roomId = 'BOT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    socket.join(roomId);

    const botId = 'bot_' + Math.random().toString(36).substring(2, 6);
    const botNames = ['Arjun @ Block 4 🤖', 'Kabir @ Tapri 🏏', 'Rohan @ MUJ 🧢', 'Vikram @ Hostel 🏆'];
    const chosenBotName = botNames[Math.floor(Math.random() * botNames.length)];

    const room: Room = {
      roomId,
      mode: 'quick',
      cameraMode: cameraMode || 'camera',
      phase: 'LOBBY',
      phaseSecondsRemaining: 0,
      players: {
        [socket.id]: {
          id: socket.id,
          username: username || 'Player',
          role: 'batsman',
          isHost: true,
          score: 0,
          wickets: 0,
          currentChoice: null,
          hasLockedIn: false,
          avatarSeed: socket.id,
        },
        [botId]: {
          id: botId,
          username: chosenBotName,
          role: 'bowler',
          isHost: false,
          score: 0,
          wickets: 0,
          currentChoice: Math.floor(Math.random() * 6) + 1,
          hasLockedIn: true,
          avatarSeed: botId,
        },
      },
      currentInning: 1,
      maxOvers: 2,
      totalBallsPerInning: 12,
      currentBallsBowled: 0,
      currentInningRuns: 0,
      currentInningWickets: 0,
      maxWicketsPerInning: 2,
      targetRuns: null,
      ballHistory: [],
      lastBallResult: null,
      winnerId: null,
      winMessage: null,
    };

    rooms[roomId] = room;
    broadcastRoom(room);
    console.log(`[Bot Match Started] Room: ${roomId} for ${username} with ${chosenBotName}`);

    // Auto-launch match countdown after 1.5s
    setTimeout(() => {
      if (rooms[roomId] && rooms[roomId].phase === 'LOBBY') {
        startPhase1SecretDelivery(rooms[roomId]);
      }
    }, 1500);
  });

  // 4. Start Match Trigger
  socket.on('start_match', ({ roomId }: { roomId: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    startPhase1SecretDelivery(room);
  });

  // 5. Submit Secret Choice (Phase 1)
  socket.on('submit_choice', ({ roomId, choice }: { roomId: string; choice: number }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[socket.id];
    if (player) {
      player.currentChoice = Math.min(6, Math.max(1, Math.floor(choice)));
      player.hasLockedIn = true;
    }

    // If both players locked in early during Phase 1 countdown, resolve immediately!
    const allLocked = Object.values(room.players).every((p) => p.hasLockedIn);
    if (allLocked && room.phase === 'PHASE_1_COUNTDOWN') {
      clearRoomTimer(room);
      resolveBall(room);
    }
  });

  // 6. Next Ball Early Advance (Phase 3 Banter Window)
  socket.on('next_ball', ({ roomId }: { roomId: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.phase === 'PHASE_3_BANTER' || room.phase === 'INNING_TRANSITION') {
      clearRoomTimer(room);
      startPhase1SecretDelivery(room);
    }
  });

  // 7. Rematch Request
  socket.on('rematch', ({ roomId }: { roomId: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    clearRoomTimer(room);
    room.phase = 'LOBBY';
    room.currentInning = 1;
    room.currentBallsBowled = 0;
    room.currentInningRuns = 0;
    room.currentInningWickets = 0;
    room.targetRuns = null;
    room.ballHistory = [];
    room.lastBallResult = null;
    room.winnerId = null;
    room.winMessage = null;

    // Reset player scores & swap initial roles
    for (const p of Object.values(room.players)) {
      p.score = 0;
      p.wickets = 0;
      p.currentChoice = null;
      p.hasLockedIn = false;
      p.role = p.isHost ? 'batsman' : 'bowler';
    }

    broadcastRoom(room);
  });

  // ------------------------------------------------------------------------
  // WEBRTC SIGNALING RELAY (P2P MESH)
  // ------------------------------------------------------------------------
  socket.on('peer_ready', ({ roomId }: { roomId: string }) => {
    socket.to(roomId).emit('peer_ready');
  });

  socket.on('offer', ({ roomId, offer }: { roomId: string; offer: any }) => {
    socket.to(roomId).emit('offer', { offer });
  });

  socket.on('answer', ({ roomId, answer }: { roomId: string; answer: any }) => {
    socket.to(roomId).emit('answer', { answer });
  });

  socket.on('ice_candidate', ({ roomId, candidate }: { roomId: string; candidate: any }) => {
    socket.to(roomId).emit('ice_candidate', { candidate });
  });

  // ------------------------------------------------------------------------
  // DISCONNECT CLEANUP
  // ------------------------------------------------------------------------
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ${socket.id}`);

    // Remove from quick match queue
    const qIdx = quickMatchQueue.indexOf(socket.id);
    if (qIdx !== -1) {
      quickMatchQueue.splice(qIdx, 1);
    }

    // Find and update any room the player was in
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players[socket.id]) {
        clearRoomTimer(room);
        delete room.players[socket.id];

        if (Object.keys(room.players).length === 0) {
          delete rooms[roomId];
        } else {
          room.phase = 'LOBBY';
          broadcastRoom(room);
          io.to(roomId).emit('game_error', {
            message: 'Opponent disconnected. Returned to room lobby.',
          });
        }
      }
    }
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    platform: 'CampusClash MUJ',
    activeRooms: Object.keys(rooms).length,
    timestamp: new Date().toISOString(),
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  CampusClash MUJ Game & Signaling Server`);
  console.log(`  Listening on http://localhost:${PORT}`);
  console.log(`  STUN Servers: stun.l.google.com:19302`);
  console.log(`===============================================`);
});
