/**
 * Not wired up yet - these shapes exist so a future WebSocket multiplayer
 * layer (rooms of players racing on the same round) can be added without
 * reshaping the single-player game state.
 */
import { Question } from './question';
import { EvaluationResult } from './evaluation';

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface Answer {
  playerId: string;
  text: string;
  result?: EvaluationResult;
  submittedAt: number;
}

export interface Round {
  id: string;
  question: Question;
  answers: Record<string, Answer>;
  startedAt: number;
  durationMs: number;
}

export interface Score {
  playerId: string;
  points: number;
  roundId: string;
}

export type RoomStatus = 'lobby' | 'in_progress' | 'finished';

export interface Room {
  id: string;
  code: string;
  players: Player[];
  rounds: Round[];
  currentRoundIndex: number;
  status: RoomStatus;
}
