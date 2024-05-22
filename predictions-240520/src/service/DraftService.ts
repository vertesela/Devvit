import { Context, RedisClient } from '@devvit/public-api';
import * as Keys from './keys.js';

export type Draft = {
  tournamentId: string;
  question: string;
  expiryDate: string;
  expiryTime: string;
  timezone: string;
  optionCount: string;
  userId: string;
};

export class DraftService {
  private readonly redis: RedisClient;

  constructor(context: Context) {
    this.redis = context.redis;
  }

  async save(draft: Draft): Promise<boolean> {
    try {
      await this.redis.hset(Keys.getDraftsKey(), {
        [Keys.getDraftField(draft.userId)]: JSON.stringify(draft),
      });

      return true;
    } catch (error) {
      console.error('Failed to save draft', error);
      return false;
    }
  }

  async get(userId: string): Promise<Draft | undefined> {
    try {
      const draft = await this.redis.hget(
        Keys.getDraftsKey(),
        Keys.getDraftField(userId)
      );
      if (!draft) {
        return undefined;
      }
      return JSON.parse(draft);
    } catch (error) {
      console.error('Failed to get draft', error);
      return undefined;
    }
  }
}
