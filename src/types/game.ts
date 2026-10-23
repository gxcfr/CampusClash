export type GamePhase = 
  | 'LOBBY'
  | 'MATCHMAKING'
  | 'PHASE_1_COUNTDOWN'  // 5s Secret Delivery
  | 'PHASE_2_REVEAL'     // Reveal & State Resolution
  | 'PHASE_3_BANTER'     // Max 10s Banter Window
  | 'INNING_TRANSITION'  // Switch between Batsman & Bowler
  | 'GAME_OVER';

export type PlayerRole = 'batsman' | 'bowler' | 'spectator';

export interface Player {
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

export interface BallResult {
  ballNumber: number;
  batsmanChoice: number;
  bowlerChoice: number;
  isWicket: boolean;
  runsScored: number;
  commentary: string;
  timestamp: number;
}

export interface InningSummary {
  inningNumber: 1 | 2;
  battingPlayerId: string;
  bowlingPlayerId: string;
  totalRuns: number;
  wickets: number;
  ballsBowled: number;
}

export type CameraMode = 'camera' | 'no-camera';

export interface RoomState {
  roomId: string;
  mode: 'party' | 'quick';
  cameraMode?: CameraMode;
  phase: GamePhase;
  phaseSecondsRemaining: number;
  players: Record<string, Player>;
  currentInning: 1 | 2;
  maxOvers: number;
  totalBallsPerInning: number;
  currentBallsBowled: number;
  currentInningRuns: number;
  currentInningWickets: number;
  targetRuns: number | null;
  ballHistory: BallResult[];
  lastBallResult: BallResult | null;
  winnerId: string | null;
  winMessage: string | null;
}

export interface HandDetectionResult {
  detectedNumber: number | null;
  fingerStates: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
  confidence: number;
  rawLandmarks?: any;
}
