import { Option } from './Option.js';

export type Post = {
  postId: string;
  options: Option[];
  title: string;
  authorId: string;
  created: number;
  ends: number;
  ended: boolean;
  correctOption?: string;
  votes: number;
  tokens: number;
  tournamentId: string;
};
