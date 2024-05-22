import {
  Context,
  RedditAPIClient,
  RedisClient,
  ZMember,
} from '@devvit/public-api';
import { ScoreboardEntry } from '../types/ScoreboardEntry.js';
import * as Keys from './keys.js';

export class ScoreboardService {
  private readonly redis: RedisClient;
  private readonly reddit: RedditAPIClient;

  constructor(context: Context) {
    this.redis = context.redis;
    this.reddit = context.reddit;
  }

  // Get the user's rank and score
  async getUser(
    tournamentId: string,
    userId?: string
  ): Promise<{
    rank: number | null;
    score: number | null;
  }> {
    if (!userId) {
      return { rank: null, score: null };
    }

    try {
      const [newScore, newRank] = await Promise.all([
        await this.redis.zScore(
          Keys.getScoreboardKey(tournamentId),
          Keys.getScoreboardField(userId)
        ),
        await this.redis.zRank(
          Keys.getScoreboardKey(tournamentId),
          Keys.getScoreboardField(userId)
        ),
      ]);

      if (newScore && newRank) {
        return {
          rank: newRank,
          score: newScore,
        };
      }
    } catch (error) {
      //console.error('Failed to get user', error);
    }

    return { rank: null, score: null };
  }

  // Get the scoreboard
  async getScoreboard(
    tournamentId: string,
    maxLength: number = 8
  ): Promise<ZMember[]> {
    try {
      const data = await this.redis.zRange(
        Keys.getScoreboardKey(tournamentId),
        0,
        maxLength,
        {
          reverse: true,
          by: 'rank',
        }
      );

      return data ?? [];
    } catch (error) {
      console.error('Failed to get scoreboard', error);
      return [];
    }
  }

  // Get the User and avatar for users on the scoreboard
  async getScoreboardUsers(
    tournamentId?: string,
    maxLength: number = 8
  ): Promise<ScoreboardEntry[]> {
    if (!tournamentId) {
      return [];
    }
    const scoreboard = await this.getScoreboard(tournamentId, maxLength);
    const users: ScoreboardEntry[] = await Promise.all(
      scoreboard.map(async (scoreboardEntry, index) => {
        const user = await this.reddit.getUserById(scoreboardEntry.member);
        const avatar = await user.getSnoovatarUrl();
        return {
          userId: user.id,
          username: user.username,
          score: scoreboardEntry.score,
          rank: index + 1,
          avatar,
        };
      })
    );

    return users;
  }

  // Get the player count
  async getPlayerCount(tournamentId: string): Promise<number> {
    try {
      const data = await this.redis.zCard(Keys.getScoreboardKey(tournamentId));
      return data ?? 0;
    } catch (error) {
      console.error('Failed to get player count', error);
      return 0;
    }
  }
}
