import { ScoreboardEntry } from './ScoreboardEntry.js';
import { Tournament } from './Tournament.js';
import { Post } from './Post.js';
import { Theme } from '../utils/getThemedColors.js';

export type AppContent = {
  post: Post;
  user: {
    rank: number;
    score: number;
    hasPredicted: boolean;
    prediction?: {
      optionId?: string;
      tokens?: number;
    };
    seenIntro: boolean;
  };
  scoreboard: ScoreboardEntry[];
  tournament: Tournament;
  settings: {
    theme: Theme;
    tokenSymbol: string;
  };
};
