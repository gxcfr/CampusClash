import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import type { RoomState, BallResult, CameraMode } from '../types/game';

type EventHandler = (...args: any[]) => void;

/**
 * Robust Zero-Cost P2P Game Adapter with:
 * 1. BroadcastChannel (0ms local multi-tab sync)
 * 2. PeerJS Public Broker (cross-device WebRTC mesh)
 * 3. Autonomous Campus Bot (instant practice & queue fallback)
 */
export class PeerGameAdapter {
  public id: string;
  public isHost: boolean = false;
  public isBotOpponent: boolean = false;
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private mediaCall: MediaConnection | null = null;
  private localStream: MediaStream | null = null;
  private eventListeners: Record<string, EventHandler[]> = {};
  private currentRoom: RoomState | null = null;
  private timerInterval: any = null;
  private targetPeerId: string | null = null;
  private targetRoomCode: string | null = null;
  private bc: BroadcastChannel | null = null;
  private queueTimeout: any = null;

  constructor() {
    this.id = 'peer_' + Math.random().toString(36).substring(2, 9);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel('campusclash_broadcast_mesh');
        this.bc.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization error:', err);
      }
    }
  }

  // Supply local camera/mic stream for peer calling
  setLocalStream(stream: MediaStream) {
    this.localStream = stream;

    // If challenger and connected to host, initiate media call
    if (!this.isHost && this.targetPeerId && this.peer && !this.mediaCall) {
      this.initiateMediaCall(this.targetPeerId);
    }
  }

  private initiateMediaCall(targetId: string) {
    if (!this.peer || !this.localStream) return;
    try {
      const call = this.peer.call(targetId, this.localStream);
      this.mediaCall = call;

      call.on('stream', (remoteStream) => {
        this.trigger('remote_stream', remoteStream);
      });

      call.on('error', (err) => {
        console.warn('Media call error:', err);
      });
    } catch (err) {
      console.warn('Failed to initiate media call:', err);
    }
  }

  // Event subscription mimicking socket.io
  on(event: string, handler: EventHandler) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }

  off(event: string, handler: EventHandler) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter((h) => h !== handler);
  }

  emit(event: string, payload?: any) {
    if (event === 'create_room') {
      this.handleCreateRoom(payload?.username, payload?.cameraMode);
    } else if (event === 'join_room') {
      this.handleJoinRoom(payload?.roomId, payload?.username);
    } else if (event === 'quick_match') {
      this.handleQuickMatch(payload?.username, payload?.cameraMode);
    } else if (event === 'start_bot_match') {
      this.startBotMatch(payload?.username, payload?.cameraMode);
    } else if (event === 'start_match') {
      this.handleStartMatch();
    } else if (event === 'submit_choice') {
      this.handleSubmitChoice(payload?.choice);
    } else if (event === 'next_ball') {
      this.handleNextBall();
    } else if (event === 'rematch') {
      this.handleRematch();
    } else if (event === 'leave_room') {
      this.handleLeaveRoom();
    } else {
      if (this.conn && this.conn.open) {
        this.conn.send({ type: event, payload });
      }
      if (this.bc && this.currentRoom) {
        this.bc.postMessage({
          type: event,
          roomId: this.currentRoom.roomId,
          senderId: this.id,
          payload,
        });
      }
    }
  }

  private trigger(event: string, ...args: any[]) {
    const handlers = this.eventListeners[event] || [];
    handlers.forEach((h) => {
      try {
        h(...args);
      } catch (err) {
        console.error(`Error in event handler for ${event}:`, err);
      }
    });
  }

  // Local tab-to-tab mesh handler
  private handleBroadcastMessage(data: any) {
    if (!data || data.senderId === this.id) return;

    if (data.type === 'queue_probe') {
      // If I am also in MATCHMAKING waiting as host, match with this player
      if (this.currentRoom?.phase === 'MATCHMAKING' && this.isHost) {
        if (this.id < data.senderId) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = '';
          for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
          this.currentRoom.roomId = code;
          this.currentRoom.phase = 'LOBBY';
          this.currentRoom.players[data.senderId] = {
            id: data.senderId,
            username: data.username || 'Challenger',
            role: 'bowler',
            isHost: false,
            score: 0,
            wickets: 0,
            currentChoice: null,
            hasLockedIn: false,
            avatarSeed: data.senderId,
          };
          this.broadcastRoom();
          if (this.bc) {
            this.bc.postMessage({
              type: 'queue_match_found',
              roomId: code,
              targetId: data.senderId,
              payload: this.currentRoom,
            });
          }
        }
      }
    } else if (data.type === 'queue_match_found' && data.targetId === this.id) {
      this.isHost = false;
      this.targetRoomCode = data.roomId;
      this.currentRoom = data.payload;
      this.trigger('room_update', data.payload);
      this.trigger('peer_ready', { roomId: data.roomId });
    } else if (data.type === 'player_leave') {
      if (this.currentRoom && this.currentRoom.roomId === data.roomId) {
        this.trigger('game_error', { message: 'Opponent left the match. Returned to lobby.' });
        if (this.isHost && this.currentRoom.players[data.senderId]) {
          delete this.currentRoom.players[data.senderId];
          this.currentRoom.phase = 'LOBBY';
          this.broadcastRoom();
        }
      }
    } else if (data.type === 'player_join') {
      if (this.isHost && this.currentRoom && this.currentRoom.roomId === data.roomId) {
        const guestId = data.senderId;
        this.currentRoom.players[guestId] = {
          id: guestId,
          username: data.username || 'Challenger',
          role: 'bowler',
          isHost: false,
          score: 0,
          wickets: 0,
          currentChoice: null,
          hasLockedIn: false,
          avatarSeed: guestId,
        };

        if (this.currentRoom.mode === 'quick') {
          this.currentRoom.phase = 'LOBBY';
        }
        this.broadcastRoom();
        this.trigger('peer_ready', { roomId: this.currentRoom.roomId });
        if (this.bc) {
          this.bc.postMessage({
            type: 'peer_ready',
            roomId: this.currentRoom.roomId,
            senderId: this.id,
          });
        }
      }
    } else if (data.type === 'room_update') {
      if (!this.isHost && this.targetRoomCode === data.roomId) {
        this.currentRoom = data.payload;
        this.trigger('room_update', data.payload);
      }
    } else if (data.type === 'countdown_tick') {
      if (!this.isHost && this.targetRoomCode === data.roomId) {
        this.trigger('countdown_tick', data.payload);
      }
    } else if (data.type === 'ball_resolved') {
      if (!this.isHost && this.targetRoomCode === data.roomId) {
        this.trigger('ball_resolved', data.payload);
      }
    } else if (data.type === 'game_over') {
      if (!this.isHost && this.targetRoomCode === data.roomId) {
        this.trigger('game_over', data.payload);
      }
    } else if (data.type === 'submit_choice') {
      if (this.isHost && this.currentRoom && this.currentRoom.roomId === data.roomId) {
        const player = this.currentRoom.players[data.senderId];
        if (player) {
          player.currentChoice = data.payload.choice;
          player.hasLockedIn = true;
          this.checkBothSubmitted();
        }
      }
    } else if (data.type === 'start_match') {
      if (this.isHost && this.currentRoom?.roomId === data.roomId) {
        this.handleStartMatch();
      }
    } else if (data.type === 'next_ball') {
      if (this.isHost && this.currentRoom?.roomId === data.roomId) {
        this.handleNextBall();
      }
    } else if (data.type === 'rematch') {
      if (this.isHost && this.currentRoom?.roomId === data.roomId) {
        this.handleRematch();
      }
    }
  }

  // 1. Host creates room
  private handleCreateRoom(username: string, cameraMode?: CameraMode) {
    this.isHost = true;
    this.isBotOpponent = false;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const peerId = `campusclash-${code}`;
    const desiredCameraMode = cameraMode || 'camera';

    const initialRoom: RoomState = {
      roomId: code,
      mode: 'party',
      cameraMode: desiredCameraMode,
      phase: 'LOBBY',
      phaseSecondsRemaining: 0,
      players: {
        [this.id]: {
          id: this.id,
          username: username || 'Player 1',
          role: 'batsman',
          isHost: true,
          score: 0,
          wickets: 0,
          currentChoice: null,
          hasLockedIn: false,
          avatarSeed: this.id,
        },
      },
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
    };

    this.currentRoom = initialRoom;
    this.trigger('room_update', initialRoom);

    // Broadcast room presence locally immediately
    if (this.bc) {
      this.bc.postMessage({
        type: 'room_update',
        roomId: code,
        senderId: this.id,
        payload: initialRoom,
      });
    }

    try {
      this.peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this.id = id;
        if (this.currentRoom) {
          const oldMe = this.currentRoom.players[this.id];
          if (!oldMe) {
            this.currentRoom.players[id] = {
              id,
              username: username || 'Player 1',
              role: 'batsman',
              isHost: true,
              score: 0,
              wickets: 0,
              currentChoice: null,
              hasLockedIn: false,
              avatarSeed: id,
            };
          }
          this.broadcastRoom();
        }
      });

      this.peer.on('connection', (connection) => {
        this.conn = connection;
        this.setupConnectionListeners(connection);
      });

      this.peer.on('call', (call) => {
        this.mediaCall = call;
        if (this.localStream) {
          call.answer(this.localStream);
        } else {
          setTimeout(() => {
            if (this.localStream) call.answer(this.localStream);
          }, 800);
        }

        call.on('stream', (remoteStream) => {
          this.trigger('remote_stream', remoteStream);
        });
      });

      this.peer.on('error', (err) => {
        console.warn('Host Peer warning:', err);
      });
    } catch (e) {
      console.warn('Failed to initialize PeerJS host:', e);
    }
  }

  // 2. Challenger joins room
  private handleJoinRoom(code: string, username: string) {
    this.isHost = false;
    this.isBotOpponent = false;
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return;

    this.targetRoomCode = cleanCode;
    const targetPeerId = `campusclash-${cleanCode}`;
    this.targetPeerId = targetPeerId;

    // 5.5s fallback timeout if host room does not exist or fails to respond
    const joinTimeout = setTimeout(() => {
      if (!this.currentRoom) {
        this.trigger('game_error', {
          message: `Unable to connect to room "${cleanCode}". Please verify the code and ensure the host is active.`,
        });
      }
    }, 5500);

    // Immediately notify via BroadcastChannel for instant local response
    if (this.bc) {
      this.bc.postMessage({
        type: 'player_join',
        roomId: cleanCode,
        senderId: this.id,
        username: username || 'Challenger',
      });
    }

    try {
      this.peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this.id = id;
        const conn = this.peer!.connect(targetPeerId);
        this.conn = conn;

        const sendJoin = () => {
          clearTimeout(joinTimeout);
          conn.send({
            type: 'player_join',
            payload: { id, username: username || 'Challenger' },
          });

          if (this.localStream) {
            this.initiateMediaCall(targetPeerId);
          }
        };

        if (conn.open) {
          sendJoin();
        } else {
          conn.on('open', sendJoin);
        }

        this.setupConnectionListeners(conn);
      });

      this.peer.on('call', (call) => {
        this.mediaCall = call;
        if (this.localStream) {
          call.answer(this.localStream);
        }
        call.on('stream', (remoteStream) => {
          this.trigger('remote_stream', remoteStream);
        });
      });

      this.peer.on('error', (err) => {
        console.warn('Challenger Peer error:', err);
        clearTimeout(joinTimeout);
        // If not already resolved by BroadcastChannel
        if (!this.currentRoom) {
          this.trigger('game_error', {
            message: `Could not connect to room "${cleanCode}". Check the 4-letter code and retry.`,
          });
        }
      });
    } catch (err) {
      clearTimeout(joinTimeout);
      console.warn('Challenger Peer init error:', err);
      this.trigger('game_error', {
        message: 'Network connection failed. Please check your connection and retry.',
      });
    }
  }

  // 3. Quick Match Queue (Searching for real players without forced bot auto-start)
  private handleQuickMatch(username: string, cameraMode?: CameraMode) {
    this.isHost = true;
    this.isBotOpponent = false;
    const desiredCameraMode = cameraMode || 'camera';

    const initialQueueRoom: RoomState = {
      roomId: '1v1 QUICK',
      mode: 'quick',
      cameraMode: desiredCameraMode,
      phase: 'MATCHMAKING',
      phaseSecondsRemaining: 0,
      players: {
        [this.id]: {
          id: this.id,
          username: username || 'Player',
          role: 'batsman',
          isHost: true,
          score: 0,
          wickets: 0,
          currentChoice: null,
          hasLockedIn: false,
          avatarSeed: this.id,
        },
      },
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
    };

    this.currentRoom = initialQueueRoom;
    this.trigger('room_update', initialQueueRoom);

    // Keep searching until a player joins or user taps "Play with Campus Bot"
    clearTimeout(this.queueTimeout);

    // Probe broadcast channel for any other tab in MATCHMAKING
    if (this.bc) {
      this.bc.postMessage({
        type: 'queue_probe',
        senderId: this.id,
        username,
        cameraMode: desiredCameraMode,
      });
    }
  }

  // Clean room exit and resource release
  public handleLeaveRoom() {
    clearTimeout(this.queueTimeout);
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.conn) {
      try {
        this.conn.send({ type: 'player_leave', payload: { id: this.id } });
        this.conn.close();
      } catch (e) {}
      this.conn = null;
    }
    if (this.mediaCall) {
      try {
        this.mediaCall.close();
      } catch (e) {}
      this.mediaCall = null;
    }
    if (this.bc && this.currentRoom) {
      this.bc.postMessage({
        type: 'player_leave',
        roomId: this.currentRoom.roomId,
        senderId: this.id,
      });
    }
    this.currentRoom = null;
    this.targetRoomCode = null;
    this.targetPeerId = null;
    this.isHost = false;
    this.isBotOpponent = false;
  }

  // 4. Instant Campus Bot Duel
  public startBotMatch(username: string, cameraMode?: CameraMode) {
    clearTimeout(this.queueTimeout);
    this.isHost = true;
    this.isBotOpponent = true;
    const botId = 'bot_campus_' + Math.random().toString(36).substring(2, 6);
    const botNames = ['Arjun @ Block 4 🤖', 'Kabir @ Tapri 🏏', 'Rohan @ MUJ 🧢', 'Vikram @ Hostel 🏆'];
    const chosenBotName = botNames[Math.floor(Math.random() * botNames.length)];
    const desiredCameraMode = cameraMode || this.currentRoom?.cameraMode || 'camera';

    const room: RoomState = {
      roomId: 'BOT-1V1',
      mode: 'quick',
      cameraMode: desiredCameraMode,
      phase: 'LOBBY',
      phaseSecondsRemaining: 0,
      players: {
        [this.id]: {
          id: this.id,
          username: username || 'Player',
          role: 'batsman',
          isHost: true,
          score: 0,
          wickets: 0,
          currentChoice: null,
          hasLockedIn: false,
          avatarSeed: this.id,
        },
        [botId]: {
          id: botId,
          username: chosenBotName,
          role: 'bowler',
          isHost: false,
          score: 0,
          wickets: 0,
          currentChoice: null,
          hasLockedIn: false,
          avatarSeed: botId,
        },
      },
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
    };

    this.currentRoom = room;
    this.trigger('room_update', room);

    // Automatically launch duel after a 1.5s visual confirmation
    setTimeout(() => {
      if (this.currentRoom?.phase === 'LOBBY') {
        this.handleStartMatch();
      }
    }, 1500);
  }

  private setupConnectionListeners(conn: DataConnection) {
    conn.on('data', (data: any) => {
      if (typeof data !== 'object' || !data.type) return;

      if (data.type === 'player_join' && this.isHost && this.currentRoom) {
        const guestId = data.payload.id;
        this.currentRoom.players[guestId] = {
          id: guestId,
          username: data.payload.username,
          role: 'bowler',
          isHost: false,
          score: 0,
          wickets: 0,
          currentChoice: null,
          hasLockedIn: false,
          avatarSeed: guestId,
        };

        if (this.currentRoom.mode === 'quick') {
          this.currentRoom.phase = 'LOBBY';
        }
        this.broadcastRoom();
        this.trigger('peer_ready', { roomId: this.currentRoom.roomId });
        try {
          conn.send({ type: 'room_update', payload: this.currentRoom });
          conn.send({ type: 'peer_ready', payload: { roomId: this.currentRoom.roomId } });
        } catch (e) {}

        if (this.localStream && this.peer) {
          try {
            const call = this.peer.call(guestId, this.localStream);
            call.on('stream', (remoteStream) => {
              this.trigger('remote_stream', remoteStream);
            });
          } catch (e) {}
        }
      } else if (data.type === 'room_update') {
        this.currentRoom = data.payload;
        this.trigger('room_update', data.payload);
      } else if (data.type === 'countdown_tick') {
        this.trigger('countdown_tick', data.payload);
      } else if (data.type === 'ball_resolved') {
        this.trigger('ball_resolved', data.payload);
      } else if (data.type === 'game_over') {
        this.trigger('game_over', data.payload);
      } else if (data.type === 'submit_choice' && this.isHost) {
        const player = this.currentRoom?.players[conn.peer];
        if (player) {
          player.currentChoice = data.payload.choice;
          player.hasLockedIn = true;
          this.checkBothSubmitted();
        }
      } else if (data.type === 'next_ball' && this.isHost) {
        this.handleNextBall();
      } else if (data.type === 'start_match' && this.isHost) {
        this.handleStartMatch();
      } else if (data.type === 'rematch' && this.isHost) {
        this.handleRematch();
      } else {
        this.trigger(data.type, data.payload);
      }
    });

    conn.on('close', () => {
      this.trigger('game_error', { message: 'Opponent disconnected.' });
    });
  }

  private broadcastRoom() {
    if (!this.currentRoom) return;
    this.trigger('room_update', this.currentRoom);
    if (this.conn && this.conn.open) {
      try {
        this.conn.send({ type: 'room_update', payload: this.currentRoom });
      } catch (e) {}
    }
    if (this.bc) {
      this.bc.postMessage({
        type: 'room_update',
        roomId: this.currentRoom.roomId,
        senderId: this.id,
        payload: this.currentRoom,
      });
    }
  }

  private handleStartMatch() {
    if (!this.isHost || !this.currentRoom) {
      if (this.conn && this.conn.open) {
        this.conn.send({ type: 'start_match' });
      }
      if (this.bc && this.currentRoom) {
        this.bc.postMessage({
          type: 'start_match',
          roomId: this.currentRoom.roomId,
          senderId: this.id,
        });
      }
      return;
    }

    this.startSecretDelivery();
  }

  private startSecretDelivery() {
    if (!this.currentRoom) return;
    clearInterval(this.timerInterval);

    this.currentRoom.phase = 'PHASE_1_COUNTDOWN';
    this.currentRoom.phaseSecondsRemaining = 5;
    for (const p of Object.values(this.currentRoom.players)) {
      p.currentChoice = null;
      p.hasLockedIn = false;
    }
    this.broadcastRoom();

    // If opponent is a bot, pick bot choice in advance
    if (this.isBotOpponent) {
      const bot = Object.values(this.currentRoom.players).find((p) => p.id !== this.id);
      if (bot) {
        // Smart realistic hand cricket probability (weight towards 1,2,4,6)
        const roll = [1, 2, 2, 3, 4, 4, 5, 6, 6];
        bot.currentChoice = roll[Math.floor(Math.random() * roll.length)];
      }
    }

    this.timerInterval = setInterval(() => {
      if (!this.currentRoom) return;
      this.currentRoom.phaseSecondsRemaining -= 1;
      const tick = { seconds: this.currentRoom.phaseSecondsRemaining };
      this.trigger('countdown_tick', tick);
      if (this.conn && this.conn.open) {
        try {
          this.conn.send({ type: 'countdown_tick', payload: tick });
        } catch (e) {}
      }
      if (this.bc) {
        this.bc.postMessage({
          type: 'countdown_tick',
          roomId: this.currentRoom.roomId,
          senderId: this.id,
          payload: tick,
        });
      }

      // If bot, mark as locked in at 2 seconds
      if (this.isBotOpponent && this.currentRoom.phaseSecondsRemaining === 2) {
        const bot = Object.values(this.currentRoom.players).find((p) => p.id !== this.id);
        if (bot) bot.hasLockedIn = true;
      }

      if (this.currentRoom.phaseSecondsRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.resolveBall();
      }
    }, 1000);
  }

  private handleSubmitChoice(choice: number) {
    if (!this.currentRoom) return;

    const me = this.currentRoom.players[this.id];
    if (me) {
      me.currentChoice = choice;
      me.hasLockedIn = true;
    }

    if (!this.isHost) {
      if (this.conn && this.conn.open) {
        try {
          this.conn.send({ type: 'submit_choice', payload: { choice } });
        } catch (e) {}
      }
      if (this.bc) {
        this.bc.postMessage({
          type: 'submit_choice',
          roomId: this.currentRoom.roomId,
          senderId: this.id,
          payload: { choice },
        });
      }
    } else {
      this.checkBothSubmitted();
    }
  }

  private checkBothSubmitted() {
    if (!this.currentRoom) return;
    const allLocked = Object.values(this.currentRoom.players).every((p) => p.hasLockedIn);
    if (allLocked && this.currentRoom.phase === 'PHASE_1_COUNTDOWN') {
      clearInterval(this.timerInterval);
      this.resolveBall();
    }
  }

  private resolveBall() {
    if (!this.currentRoom) return;
    clearInterval(this.timerInterval);

    this.currentRoom.phase = 'PHASE_2_REVEAL';

    const batsman = Object.values(this.currentRoom.players).find((p) => p.role === 'batsman');
    const bowler = Object.values(this.currentRoom.players).find((p) => p.role === 'bowler');

    if (batsman && batsman.currentChoice === null) batsman.currentChoice = Math.floor(Math.random() * 6) + 1;
    if (bowler && bowler.currentChoice === null) bowler.currentChoice = Math.floor(Math.random() * 6) + 1;

    const batsmanChoice = batsman?.currentChoice || 1;
    const bowlerChoice = bowler?.currentChoice || 1;

    this.currentRoom.currentBallsBowled += 1;
    const isWicket = batsmanChoice === bowlerChoice;
    const runsScored = isWicket ? 0 : batsmanChoice;

    let commentary = '';
    if (isWicket) {
      this.currentRoom.currentInningWickets += 1;
      commentary = `OUT! Clean bowled! Both showed ${batsmanChoice}!`;
    } else {
      this.currentRoom.currentInningRuns += runsScored;
      commentary = runsScored === 6 ? 'MAXIMUM! Hit over the campus wall for SIX!' : `Scored ${runsScored} runs!`;
    }

    const ballResult: BallResult = {
      ballNumber: this.currentRoom.currentBallsBowled,
      batsmanChoice,
      bowlerChoice,
      isWicket,
      runsScored,
      commentary,
      timestamp: Date.now(),
    };

    this.currentRoom.lastBallResult = ballResult;
    this.currentRoom.ballHistory.push(ballResult);

    this.trigger('ball_resolved', ballResult);
    if (this.conn && this.conn.open) {
      try {
        this.conn.send({ type: 'ball_resolved', payload: ballResult });
      } catch (e) {}
    }
    if (this.bc) {
      this.bc.postMessage({
        type: 'ball_resolved',
        roomId: this.currentRoom.roomId,
        senderId: this.id,
        payload: ballResult,
      });
    }
    this.broadcastRoom();

    setTimeout(() => {
      this.checkMatchProgress();
    }, 2500);
  }

  private checkMatchProgress() {
    if (!this.currentRoom) return;
    const isInningOver =
      this.currentRoom.currentInningWickets >= 2 ||
      this.currentRoom.currentBallsBowled >= this.currentRoom.totalBallsPerInning;

    if (this.currentRoom.currentInning === 2 && this.currentRoom.targetRuns !== null) {
      const chasing = Object.values(this.currentRoom.players).find((p) => p.role === 'batsman');
      const defending = Object.values(this.currentRoom.players).find((p) => p.role === 'bowler');

      if (this.currentRoom.currentInningRuns >= this.currentRoom.targetRuns) {
        this.currentRoom.phase = 'GAME_OVER';
        this.currentRoom.winnerId = chasing?.id || null;
        this.currentRoom.winMessage = `${chasing?.username} chased down ${this.currentRoom.targetRuns} runs! 🏆`;
        this.broadcastRoom();
        this.trigger('game_over', { winnerId: this.currentRoom.winnerId });
        if (this.conn?.open) this.conn.send({ type: 'game_over', payload: { winnerId: this.currentRoom.winnerId } });
        return;
      }

      if (isInningOver) {
        this.currentRoom.phase = 'GAME_OVER';
        this.currentRoom.winnerId = defending?.id || null;
        this.currentRoom.winMessage = `${defending?.username} defended the target! 🏆`;
        this.broadcastRoom();
        this.trigger('game_over', { winnerId: this.currentRoom.winnerId });
        if (this.conn?.open) this.conn.send({ type: 'game_over', payload: { winnerId: this.currentRoom.winnerId } });
        return;
      }
    }

    if (this.currentRoom.currentInning === 1 && isInningOver) {
      this.currentRoom.currentInning = 2;
      this.currentRoom.targetRuns = this.currentRoom.currentInningRuns + 1;
      this.currentRoom.currentBallsBowled = 0;
      this.currentRoom.currentInningRuns = 0;
      this.currentRoom.currentInningWickets = 0;
      this.currentRoom.phase = 'INNING_TRANSITION';

      for (const p of Object.values(this.currentRoom.players)) {
        p.role = p.role === 'batsman' ? 'bowler' : 'batsman';
        p.currentChoice = null;
        p.hasLockedIn = false;
      }
      this.broadcastRoom();
      return;
    }

    this.startBanter();
  }

  private startBanter() {
    if (!this.currentRoom) return;
    clearInterval(this.timerInterval);

    this.currentRoom.phase = 'PHASE_3_BANTER';
    this.currentRoom.phaseSecondsRemaining = 10;
    this.broadcastRoom();

    this.timerInterval = setInterval(() => {
      if (!this.currentRoom) return;
      this.currentRoom.phaseSecondsRemaining -= 1;
      const tick = { seconds: this.currentRoom.phaseSecondsRemaining };
      this.trigger('countdown_tick', tick);
      if (this.conn?.open) {
        try {
          this.conn.send({ type: 'countdown_tick', payload: tick });
        } catch (e) {}
      }

      if (this.currentRoom.phaseSecondsRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.startSecretDelivery();
      }
    }, 1000);
  }

  private handleNextBall() {
    if (!this.isHost) {
      if (this.conn?.open) this.conn.send({ type: 'next_ball' });
      if (this.bc && this.currentRoom) {
        this.bc.postMessage({
          type: 'next_ball',
          roomId: this.currentRoom.roomId,
          senderId: this.id,
        });
      }
      return;
    }
    if (this.currentRoom?.phase === 'PHASE_3_BANTER' || this.currentRoom?.phase === 'INNING_TRANSITION') {
      clearInterval(this.timerInterval);
      this.startSecretDelivery();
    }
  }

  private handleRematch() {
    if (!this.isHost) {
      if (this.conn?.open) this.conn.send({ type: 'rematch' });
      if (this.bc && this.currentRoom) {
        this.bc.postMessage({
          type: 'rematch',
          roomId: this.currentRoom.roomId,
          senderId: this.id,
        });
      }
      return;
    }
    if (!this.currentRoom) return;
    clearInterval(this.timerInterval);
    this.currentRoom.phase = 'LOBBY';
    this.currentRoom.currentInning = 1;
    this.currentRoom.currentBallsBowled = 0;
    this.currentRoom.currentInningRuns = 0;
    this.currentRoom.currentInningWickets = 0;
    this.currentRoom.targetRuns = null;
    this.currentRoom.ballHistory = [];
    this.currentRoom.lastBallResult = null;
    this.currentRoom.winnerId = null;
    this.currentRoom.winMessage = null;
    for (const p of Object.values(this.currentRoom.players)) {
      p.score = 0;
      p.wickets = 0;
      p.currentChoice = null;
      p.hasLockedIn = false;
      p.role = p.isHost ? 'batsman' : 'bowler';
    }
    this.broadcastRoom();

    if (this.isBotOpponent) {
      setTimeout(() => {
        if (this.currentRoom?.phase === 'LOBBY') {
          this.handleStartMatch();
        }
      }, 1000);
    }
  }

  public disconnect() {
    clearInterval(this.timerInterval);
    clearTimeout(this.queueTimeout);
    if (this.mediaCall) this.mediaCall.close();
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    if (this.bc) this.bc.close();
  }
}
