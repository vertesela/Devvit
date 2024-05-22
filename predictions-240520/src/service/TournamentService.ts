import { Context, RedisClient, RedditAPIClient } from '@devvit/public-api';
import { Tournament } from '../types/Tournament.js';
import { TournamentQuestion } from '../types/TournamentQuestion.js';
import * as Keys from './keys.js';
import AppAccount from '../data/app-account.json';

export class TournamentService {
  private readonly redis: RedisClient;
  private readonly reddit: RedditAPIClient;

  constructor(context: Context) {
    this.redis = context.redis;
    this.reddit = context.reddit;
  }

  /*
   * Start a tournament
   */

  async start(tournament: Tournament): Promise<boolean> {
    const { id, name, tokens, created, authorId } = tournament;

    try {
      const tournamentKey = Keys.getTournamentKey(id);
      const tx = await this.redis.watch(tournamentKey);
      await tx.multi();

      // Save the tournament data
      await tx.hset(Keys.getTournamentKey(tournament.id), {
        id,
        name,
        tokens: JSON.stringify(tokens),
        created: JSON.stringify(created),
        authorId,
        ended: JSON.stringify(false),
      });

      // Add the tournament id to the list of tournaments
      await tx.zAdd(Keys.getTournamentsKey(), {
        member: id,
        score: created,
      });

      // Initialize the scoreboard
      await tx.zAdd(Keys.getScoreboardKey(id), {
        member: Keys.getScoreboardField(AppAccount.id),
        score: 0,
      });

      await tx.exec();
      return true;
    } catch (error) {
      console.error('Failed to start tournament', error);
      return false;
    }
  }

  // Get a tournament by id
  async get(tournamentId: string): Promise<Tournament | undefined> {
    const data = await this.redis.hgetall(Keys.getTournamentKey(tournamentId));

    if (!data || Object.keys(data).length === 0) {
      console.error('Tournament not found');
      return undefined;
    }

    // Parse the questions
    const questions: TournamentQuestion[] = Object.keys(data)
      .filter((key) => key.startsWith('question:'))
      .map((key) => {
        const [_prefix, postId, field] = key.split(':');
        if (field === 'title') {
          const question: TournamentQuestion = {
            postId,
            title: data[Keys.questionField(postId, 'title')],
            tokens: parseInt(data[Keys.questionField(postId, 'tokens')]),
            votes: parseInt(data[Keys.questionField(postId, 'votes')]),
            created: parseInt(data[Keys.questionField(postId, 'created')]),
            ends: parseInt(data[Keys.questionField(postId, 'ends')]),
            ended: data[Keys.questionField(postId, 'ended')] === 'true',
            resolved: data[Keys.questionField(postId, 'resolved')] === 'true',
          };
          return question;
        }
      })
      .filter((question) => question !== undefined) as TournamentQuestion[];

    return {
      id: data.id,
      name: data.name,
      tokens: parseInt(data.tokens),
      created: parseInt(data.created),
      authorId: data.authorId,
      ended: JSON.parse(data.ended),
      questions,
    };
  }

  /*
   * End a tournament
   */

  async end(tournamentId: string, message?: string): Promise<boolean> {
    // TODO: Check if all questions have been resolved first
    // TODO: Bulk message all participants with the results
    // TODO: Add the moderators message to the end message
    // TODO: Create a scoreboard post to summarize the results
    try {
      await this.redis.hset(Keys.getTournamentKey(tournamentId), {
        ended: JSON.stringify(Date.now()),
      });
      return true;
    } catch (error) {
      console.error('Failed to end tournament', error);
      return false;
    }
  }

  /*
   * Rename a tournament
   */

  async rename(tournamentId: string, newName: string): Promise<boolean> {
    const tournament = await this.get(tournamentId);

    // Validate that a tournament by that id exists
    if (!tournament) {
      console.error('Tournament not found');
      return false;
    }

    // Validate that the new name is not empty
    if (newName.trim() === '' || newName.length === 0) {
      console.error('New name is empty');
      return false;
    }

    try {
      await this.redis.hset(Keys.getTournamentKey(tournamentId), {
        name: newName,
      });
      return true;
    } catch (error) {
      console.error('Failed to rename tournament', error);
      return false;
    }
  }

  /*
   * Get all tournaments
   */

  async getAll(): Promise<Tournament[]> {
    try {
      const data = await this.redis.zRange(Keys.getTournamentsKey(), 0, -1, {
        reverse: true,
        by: 'rank',
      });

      const tournamentIds = data.map((tournament) => tournament.member);
      const tournaments = await Promise.all(
        tournamentIds.map((id) => this.get(id))
      );
      const filteredTournaments = tournaments.filter(
        (tournament) => tournament !== undefined
      ) as Tournament[];

      return filteredTournaments;
    } catch (error) {
      console.error('Failed to get all tournaments', error);
      return [];
    }
  }

  /*
   * Get all active tournaments
   */

  async getAllActive(): Promise<Tournament[]> {
    try {
      const tournaments = await this.getAll();
      const filteredTournaments = tournaments.filter(
        (tournament) => !tournament.ended
      ) as Tournament[];
      return filteredTournaments;
    } catch (error) {
      console.error('Failed to get active tournaments', error);
      return [];
    }
  }

  /*
   * Intro seen tracking
   */

  async setIntroSeen(tournamentId: string, userId: string): Promise<void> {
    await this.redis.hset(Keys.getIntroSeenKey(tournamentId), {
      [Keys.getIntroSeenField(userId)]: 'true',
    });
  }

  async getIntroSeen(tournamentId?: string, userId?: string): Promise<boolean> {
    if (!tournamentId || !userId) return false;

    const data = await this.redis.hget(
      Keys.getIntroSeenKey(tournamentId),
      Keys.getIntroSeenField(userId)
    );

    return data === 'true';
  }

  /*
   * Dispense tokens
   */

  async dispenseTokens(
    tournamentId: string,
    tokens: number,
    message?: string
  ): Promise<void> {
    console.log('Dispensing tokens');
    const startTime = Date.now();
    const tournament = await this.get(tournamentId);
    const players: {
      member: string;
      score: number;
    }[] = await this.redis.zRange(Keys.getScoreboardKey(tournamentId), 0, -1);

    if (!tournament) {
      console.error('Tournament not found');
      return;
    }

    // Update the tournament's starting token balance
    // so that new players also get the tokens.
    await this.redis.hincrby(
      Keys.getTournamentKey(tournamentId),
      'tokens',
      tokens
    );

    // Iterate over all the current players to:
    for (const player of players) {
      const [_newPlayerScore, user] = await Promise.all([
        // Increment the player's token balance
        await this.redis.zIncrBy(
          Keys.getScoreboardKey(tournamentId),
          player.member,
          tokens
        ),
        // Get the player's reddit user
        await this.reddit.getUserById(player.member),
      ]);

      // Send a message to the player
      await this.reddit.sendPrivateMessage({
        to: user.username,
        subject: 'You got tokens!',
        text: `Greetings ${
          user.username
        }! A moderator has dispensed ${tokens.toLocaleString()} tokens to all players in the "${
          tournament.name
        }" predictions tournament. Fortune favors the bold! ${
          message ? `The moderator added a note: "${message}"` : ''
        }`,
      });
    }

    console.log(
      `Tokens dispensed! It took ${(Date.now() - startTime) / 1000}s`
    );
  }
}
