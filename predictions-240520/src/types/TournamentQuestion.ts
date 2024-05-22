export type TournamentQuestion = {
  postId: string;
  title: string;
  tokens: number;
  votes: number;
  created: number;
  ends: number;
  ended: boolean;
  resolved: boolean;
  user?: {
    hasPredicted?: boolean;
    optionId?: string;
    tokens?: number;
  };
};
