import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import type { RoomState, BallResult } from '../types/game';

type EventHandler = (...args: any[]) => void;

/**
 * Serverless P2P Game Adapter for Vercel Deployments
 * Uses free Google STUN and PeerJS public broker to enable 100% zero-cost
 * cross-device 1v1 play even without a Node.js backend running!
 */
export class PeerGameAdapter {
  public id: string;
  public isHost: boolean = false;
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private mediaCall: MediaConnection | null = null;
  private localStream: MediaStream | null = null;
  private eventListeners: Record<string, EventHandler[]> = {};
  private currentRoom: RoomState | null = null;
  private timerInterval: any = null;
  private targetPeerId: string | null = null;

  constructor() {
    this.id = 'peer_' + Math.random().toString(36).substring(2, 9);
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
      this.handleCreateRoom(payload?.username);
    } else if (event === 'join_room') {
      this.handleJoinRoom(payload?.roomId, payload?.username);
    } else if (event === 'quick_match') {
      this.handleQuickMatch(payload?.username);
    } else if (event === 'start_match') {
      this.handleStartMatch();
    } else if (event === 'submit_choice') {
      this.handleSubmitChoice(payload?.choice);
    } else if (event === 'next_ball') {
      this.handleNextBall();
    } else if (event === 'rematch') {
      this.handleRematch();
    } else {
      if (this.conn && this.conn.open) {
        this.conn.send({ type: event, payload });
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

  // 1. Host creates room
  private handleCreateRoom(username: string) {
    this.isHost = true;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const peerId = `campusclash-${code}`;

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
      const initialRoom: RoomState = {
        roomId: code,
        mode: 'party',
        phase: 'LOBBY',
        phaseSecondsRemaining: 0,
        players: {
          [id]: {
            id,
            username: username || 'Player 1',
            role: 'batsman',
            isHost: true,
            score: 0,
            wickets: 0,
            currentChoice: null,
            hasLockedIn: false,
            avatarSeed: id,
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
    });

    // Handle incoming data connection
    this.peer.on('connection', (connection) => {
      this.conn = connection;
      this.setupConnectionListeners(connection);
    });

    // Handle incoming media call (Challenger calling Host)
    this.peer.on('call', (call) => {
      this.mediaCall = call;
      if (this.localStream) {
        call.answer(this.localStream);
      } else {
        // If local stream not yet ready, wait briefly
        setTimeout(() => {
          if (this.localStream) {
            call.answer(this.localStream);
          }
        }, 800);
      }

      call.on('stream', (remoteStream) => {
        this.trigger('remote_stream', remoteStream);
      });
    });

    this.peer.on('error', (err) => {
      console.warn('Host Peer error:', err);
      this.trigger('game_error', { message: 'Connection issue. Please retry.' });
    });
  }

  // 2. Challenger joins room
  private handleJoinRoom(code: string, username: string) {
    this.isHost = false;
    const targetPeerId = `campusclash-${code.toUpperCase()}`;
    this.targetPeerId = targetPeerId;

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

      conn.on('open', () => {
        conn.send({
          type: 'player_join',
          payload: { id, username: username || 'Challenger' },
        });

        // If local stream already captured, initiate media call to Host
        if (this.localStream) {
          this.initiateMediaCall(targetPeerId);
        }
      });

      this.setupConnectionListeners(conn);
    });

    // Also listen for incoming calls
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
      this.trigger('game_error', { message: 'Could not connect to room. Check the code.' });
    });
  }

  private handleQuickMatch(username: string) {
    this.handleCreateRoom(username);
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
        this.broadcastRoom();
        this.trigger('peer_ready', { roomId: this.currentRoom.roomId });
        conn.send({ type: 'peer_ready', payload: { roomId: this.currentRoom.roomId } });

        // If host has stream, call challenger as well for bi-directional AV
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
      this.conn.send({ type: 'room_update', payload: this.currentRoom });
    }
  }

  private handleStartMatch() {
    if (!this.isHost || !this.currentRoom) {
      if (this.conn && this.conn.open) {
        this.conn.send({ type: 'start_match' });
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

    this.timerInterval = setInterval(() => {
      if (!this.currentRoom) return;
      this.currentRoom.phaseSecondsRemaining -= 1;
      const tick = { seconds: this.currentRoom.phaseSecondsRemaining };
      this.trigger('countdown_tick', tick);
      if (this.conn && this.conn.open) {
        this.conn.send({ type: 'countdown_tick', payload: tick });
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
        this.conn.send({ type: 'submit_choice', payload: { choice } });
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
      commentary = `OUT! Clean bowled! Both chose ${batsmanChoice}!`;
    } else {
      this.currentRoom.currentInningRuns += runsScored;
      commentary = runsScored === 6 ? 'MAXIMUM! Hit out of the campus for SIX!' : `Scored ${runsScored} runs!`;
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
      this.conn.send({ type: 'ball_resolved', payload: ballResult });
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
        this.currentRoom.winMessage = `${defending?.username} won the match! 🏆`;
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
      if (this.conn?.open) this.conn.send({ type: 'countdown_tick', payload: tick });

      if (this.currentRoom.phaseSecondsRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.startSecretDelivery();
      }
    }, 1000);
  }

  private handleNextBall() {
    if (!this.isHost) {
      if (this.conn?.open) this.conn.send({ type: 'next_ball' });
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
    this.broadcastRoom();
  }

  public disconnect() {
    clearInterval(this.timerInterval);
    if (this.mediaCall) this.mediaCall.close();
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}
