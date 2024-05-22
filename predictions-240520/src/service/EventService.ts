import { Context, RedisClient } from '@devvit/public-api';
import { PredictionEvent } from '../types/PredictionEvent.js';
import * as Keys from './keys.js';

export class EventService {
  private readonly redis: RedisClient;

  constructor(context: Context) {
    this.redis = context.redis;
  }

  /*
   * Process a prediction event
   */

  // Get the user's score
  private async getUserScore(
    userId: string,
    tournamentId: string,
    tournamentTokenDefault: number
  ): Promise<number> {
    try {
      const data = await this.redis.zScore(
        Keys.getScoreboardKey(tournamentId),
        Keys.getScoreboardField(userId)
      );

      if (!isNaN(data)) {
        return data;
      }

      return data ?? tournamentTokenDefault;
    } catch (error) {
      // console.error(`Failed to get token balance for ${userId}`);
      return tournamentTokenDefault;
    }
  }

  async submitPrediction(
    event: PredictionEvent & { tournamentTokenDefault: number }
  ): Promise<void> {
    const {
      postId,
      userId,
      optionId,
      tokens,
      tournamentId,
      tournamentTokenDefault,
    } = event;

    // Check if user has sufficient balance for the transaction
    const userBalance =
      (await this.getUserScore(userId, tournamentId, tournamentTokenDefault)) ??
      0;
    if (userBalance - tokens < 0) {
      //console.log('Insufficient balance', userBalance, amount);
      return;
    }

    const tx = await this.redis.watch(
      Keys.getPostKey(postId),
      Keys.getScoreboardKey(tournamentId),
      Keys.getPostEventsKey(postId),
      Keys.getTournamentKey(tournamentId)
    );
    await tx.multi();

    // Increment the vote count for the selected option on the post
    await tx.hincrby(
      Keys.getPostKey(postId),
      Keys.getOptionFieldKey(optionId, 'votes'),
      1
    );

    // Increment the total vote count on the post
    await tx.hincrby(Keys.getPostKey(postId), 'votes', 1);

    // Increment the posts token count
    await tx.hincrby(Keys.getPostKey(postId), 'tokens', tokens);

    // Subtract the token amount from the user's balance
    await tx.zAdd(Keys.getScoreboardKey(tournamentId), {
      member: Keys.getScoreboardField(userId),
      score: userBalance - tokens,
    });

    const timestamp = Date.now();
    // Add a prediction event to the post (used for resolving predictions)
    await tx.hset(Keys.getPostEventsKey(postId), {
      [Keys.getEventField('prediction', userId)]: JSON.stringify({
        optionId,
        timestamp,
        tokens,
        postId,
        userId,
      }),
    });

    // Add a prediction event to the user (used for user state)
    await tx.hset(Keys.getUserEventsKey(tournamentId, userId), {
      [Keys.getEventField('prediction', postId)]: JSON.stringify({
        optionId,
        timestamp,
        tokens,
        postId,
        userId,
      }),
    });

    // Increment the tournament question's prediction count
    await tx.hincrby(
      Keys.getTournamentKey(tournamentId),
      Keys.questionField(postId, 'votes'),
      1
    );

    // Increment the tournament question's token count
    await tx.hincrby(
      Keys.getTournamentKey(tournamentId),
      Keys.questionField(postId, 'tokens'),
      tokens
    );

    await tx.exec();
  }

  // Get all user events for a tournament
  async getUserEvents(
    tournamentId?: string,
    userId?: string
  ): Promise<PredictionEvent[]> {
    if (!userId || !tournamentId) {
      return [];
    }
    try {
      const result = await this.redis.hgetall(
        Keys.getUserEventsKey(tournamentId, userId)
      );

      if (!result) {
        return [];
      }

      const parsedResults = Object.keys(result).map((key) => {
        return JSON.parse(result[key]);
      });

      return parsedResults;
    } catch (error) {
      // No events found for {userId}
      return [];
    }
  }
}
