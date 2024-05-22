import { TournamentQuestion } from './TournamentQuestion.js';

export type Tournament = {
  id: string;
  name: string;
  tokens: number;
  created: number;
  authorId: string;
  ended: boolean;
  questions?: TournamentQuestion[];
  playerCount?: number;
};
