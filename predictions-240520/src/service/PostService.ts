import { Context, RedisClient, RedditAPIClient } from '@devvit/public-api';
import { Post } from '../types/Post.js';
import { Option } from '../types/Option.js';
import * as Keys from './keys.js';
import { PredictionEvent } from '../types/PredictionEvent.js';

export class PostService {
  private readonly redis: RedisClient;
  private readonly reddit: RedditAPIClient;

  constructor(context: Context) {
    this.redis = context.redis;
    this.reddit = context.reddit;
  }

  /*
   * Create a new post
   */

  async create(data: Post): Promise<boolean> {
    const {
      postId,
      title,
      authorId,
      created,
      ends,
      ended,
      tokens,
      tournamentId,
    } = data;

    const options: { [key: string]: string } = {};
    data.options.forEach((option) => {
      options[Keys.getOptionFieldKey(option.id, 'label')] = option.label;
      options[Keys.getOptionFieldKey(option.id, 'votes')] = JSON.stringify(0);
    });

    const post = {
      postId,
      title,
      authorId,
      created: JSON.stringify(created),
      ends: JSON.stringify(ends),
      ended: JSON.stringify(ended),
      tokens: JSON.stringify(tokens),
      tournamentId,
      ...options,
    };

    const tournamentQuestion: {
      [field: string]: string;
    } = {
      [Keys.questionField(postId, 'title')]: data.title,
      [Keys.questionField(postId, 'tokens')]: JSON.stringify(0),
      [Keys.questionField(postId, 'votes')]: JSON.stringify(0),
      [Keys.questionField(postId, 'ends')]: JSON.stringify(ends),
      [Keys.questionField(postId, 'ended')]: JSON.stringify(false),
      [Keys.questionField(postId, 'resolved')]: JSON.stringify(false),
      [Keys.questionField(postId, 'created')]: JSON.stringify(created),
    };

    try {
      const postKey = Keys.getPostKey(postId);
      const tx = await this.redis.watch(
        postKey,
        Keys.getTournamentKey(tournamentId)
      );
      await tx.multi();

      // Save the post data
      await tx.hset(Keys.getPostKey(postId), post);

      // Add post to tournament
      await tx.hset(Keys.getTournamentKey(tournamentId), tournamentQuestion);

      await tx.exec();
      return true;
    } catch (error) {
      console.error('Failed to create post', error);
      return false;
    }
  }

  /*
   * Resolve a prediction post
   */

  async resolve(
    postId: string,
    optionId: string,
    tournamentId: string
  ): Promise<void> {
    console.log('Resolving post', postId);
    const startTime = Date.now();

    // Get all prediction events for the post
    const predictionEvents = await this.redis.hgetall(
      Keys.getPostEventsKey(postId)
    );

    if (!predictionEvents) {
      console.error('No prediction events found');
      return;
    }

    // Update the post data with the correct option and ended status
    await this.redis.hset(Keys.getPostKey(postId), {
      correctOption: optionId,
      ended: JSON.stringify(true),
    });

    // Update the tournament question with the ended status
    await this.redis.hset(Keys.getTournamentKey(tournamentId), {
      [Keys.questionField(postId, 'ended')]: JSON.stringify(true),
    });

    // How many tokens were bet on this post?
    const tokens =
      JSON.parse(
        (await this.redis.hget(Keys.getPostKey(postId), 'tokens')) || ''
      ) ?? 0;

    // How many tokens did the winners place?
    let winningTokens = 0;
    const winners = [];

    // Iterate over the prediction events and tally up some stats.
    for (const key in predictionEvents) {
      if (predictionEvents.hasOwnProperty(key)) {
        const event = JSON.parse(predictionEvents[key]);
        const isWinner = event.optionId === optionId;
        if (isWinner) {
          winningTokens += event.tokens;
          winners.push(event);
        }
      }
    }

    const winnerCount = winners.length;

    for (const key in predictionEvents) {
      const event: PredictionEvent = JSON.parse(predictionEvents[key]);
      const isWinner = event.optionId === optionId;

      const [user, post] = await Promise.all([
        // Get the user's username
        await this.reddit.getUserById(event.userId),
        // Get the post
        await this.reddit.getPostById(event.postId),
      ]);

      if (isWinner) {
        const percentageOfWinningTokens = (event.tokens / winningTokens) * 100;
        const amount = Math.round((percentageOfWinningTokens / 100) * tokens);

        const newPlayerScore = await this.redis.zIncrBy(
          Keys.getScoreboardKey(tournamentId),
          Keys.getScoreboardField(event.userId),
          amount
        );

        // Message the winners
        this.reddit.sendPrivateMessage({
          to: user.username,
          subject: 'Winning! Your prediction paid off',
          text: `Hey ${user.username}, your prediction was correct! You sure do know your stuff.

You&apos;ve earned ${amount} tournament tokens, and you can view your overall standings in the [Tournament Leaderboard](${post.permalink}) to see how you stack up against your fellow predictors.
          
Check out [your prediction here](${post.permalink}). Congratulations on the big win! 
          
Keep an eye out for the next prediction and keep your winning streak going.`,
        });

        continue;
      }

      // Message the losers
      this.reddit.sendPrivateMessage({
        to: user.username,
        subject: 'Better luck next prediction',
        text: `Sorry, ${user.username}  your prediction didn&apos;t come through this time. But don&apos;t worry, you&apos;ll get &apos;em next time.

Thanks for throwing your ${event.tokens} tournament tokens into the game. Those who predicted correctly, split the winnings and you helped make them very happy. 

Check out [your prediction here](${post.permalink}).

Keep an eye out for the next prediction. Your day will come!`,
      });
    }

    console.log(`Resolved post in ${(Date.now() - startTime) / 1000}s`);
  }

  // Get a post by id
  async get(postId: string): Promise<Post | undefined> {
    const data = await this.redis.hgetall(Keys.getPostKey(postId));

    if (!data || data === undefined) {
      console.error('Post not found');
      return undefined;
    }

    // Parse the options data
    const options = Object.keys(data)
      .filter((key) => key.startsWith('option:'))
      .sort((a, b) => {
        const [, optionIdA] = a.split(':');
        const [, optionIdB] = b.split(':');
        const optionIdANumber = Number(optionIdA);
        const optionIdBNumber = Number(optionIdB);
        return optionIdANumber - optionIdBNumber;
      })
      .map((key) => {
        const [_prefix, optionId, field] = key.split(':');
        if (field === 'label' && data) {
          const votesKey = Keys.getOptionFieldKey(optionId, 'votes');
          const votes = parseInt(data[votesKey] || '0') || 0;
          return {
            label: data[Keys.getOptionFieldKey(optionId, 'label')],
            id: optionId,
            votes,
          };
        }
      })
      .filter((option) => option !== undefined) as Option[];

    const post: Post = {
      postId: data.postId,
      options,
      title: data.title,
      authorId: data.authorId,
      created: parseInt(data.created),
      ends: parseInt(data.ends),
      ended: JSON.parse(data.ended),
      votes: parseInt(data.votes) ?? 0,
      tokens: parseInt(data.tokens) ?? 0,
      tournamentId: data.tournamentId,
    };

    if (data.correctOption) {
      post.correctOption = data.correctOption;
    }

    return post;
  }

  /*
   * Change the end time of a post
   */

  async changeEndTime(postId: string, newEnd: number): Promise<void> {
    const post = await this.get(postId);
    if (!post) {
      console.error('Post not found');
      return;
    }

    const tx = await this.redis.watch(
      Keys.getPostKey(post.postId),
      Keys.getTournamentKey(post?.tournamentId)
    );

    await tx.multi();

    // update the post
    await this.redis.hset(Keys.getPostKey(postId), {
      ends: JSON.stringify(newEnd),
      ended: JSON.stringify(newEnd < Date.now()),
    });

    // update the tournament
    await this.redis.hset(Keys.getTournamentKey(post?.tournamentId), {
      [Keys.questionField(post.postId, 'ends')]: JSON.stringify(newEnd),
      [Keys.questionField(post.postId, 'ended')]: JSON.stringify(
        newEnd < Date.now()
      ),
    });

    await tx.exec();
  }

  /*
   * End a post now
   */

  async end(postId: string): Promise<void> {
    const post = await this.get(postId);
    if (!post) {
      console.error('Post not found');
      return;
    }

    const ends = JSON.stringify(Date.now());
    const ended = 'true';
    const tx = await this.redis.watch(
      Keys.getPostKey(post.postId),
      Keys.getTournamentKey(post?.tournamentId)
    );
    await tx.multi();

    // Update the post
    await this.redis.hset(Keys.getPostKey(postId), {
      ends,
      ended,
    });

    // Update the tournament
    await this.redis.hset(Keys.getTournamentKey(post?.tournamentId), {
      [Keys.questionField(post.postId, 'ends')]: ends,
      [Keys.questionField(post.postId, 'ended')]: JSON.stringify(ended),
    });

    await tx.exec();
  }

  /*
   * Remove post and refund all players
   */

  async remove(settings: { postId: string; message?: string }): Promise<void> {
    const { postId, message } = settings;
    console.log('Removing post', postId);
    const startTime = Date.now();

    const [post, postEvents] = await Promise.all([
      await this.get(postId),
      await this.redis.hgetall(Keys.getPostEventsKey(postId)),
    ]);

    if (!post) {
      console.error('Post not found');
      return;
    }

    const tx = await this.redis.watch(
      Keys.getPostKey(postId),
      Keys.getTournamentKey(post?.tournamentId),
      Keys.getPostEventsKey(postId)
    );
    await tx.multi();

    // Remove the post
    await tx.del(Keys.getPostKey(postId));

    // Remove the post from the tournament
    const tournamentKeys = [
      'title',
      'tokens',
      'votes',
      'created',
      'ends',
      'ended',
      'resolved',
    ];

    for (const key of tournamentKeys) {
      await tx.del(Keys.getTournamentKey(Keys.questionField(postId, key)));
    }

    // Remove the post events
    await tx.del(Keys.getPostEventsKey(postId));
    await tx.exec();

    // Remove the post in Reddit
    const redditPost = await this.reddit.getPostById(postId);
    redditPost.remove();

    // Undo all the post events
    for (const key in postEvents) {
      if (postEvents.hasOwnProperty(key)) {
        const event: PredictionEvent = JSON.parse(postEvents[key]);

        const [newPlayerScore, user] = await Promise.all([
          // Refund the players
          await this.redis.zIncrBy(
            Keys.getScoreboardKey(post.tournamentId),
            Keys.getScoreboardField(event.userId),
            event.tokens
          ),
          // Get the user's username
          await this.reddit.getUserById(event.userId),
        ]);

        // Message players about the refund
        this.reddit.sendPrivateMessage({
          to: user.username,
          subject: `Don't worry, there will be other predictions`,
          text: `Hey ${user.username},

Thanks for submitting your prediction. We&apos;re sorry to say that it was cancelled by the person who created it. Bummer we know, but don&apos;t worry, you&apos;ll have other chances to win.
   
Your ${event.tokens} tournament tokens have been refunded. 

Keep an eye out for the next prediction. Your day will come!

${
  message &&
  `The moderator added the following message:
> ${message}`
}`,
        });
      }
    }

    console.log(`Removed post in ${(Date.now() - startTime) / 1000}s`);
  }
}
