import {
  Context,
  RedditAPIClient,
  RedisClient,
  SettingsClient,
  SettingsValues,
} from '@devvit/public-api';
import { DraftService } from './DraftService.js';
import { PostService } from './PostService.js';
import { EventService } from './EventService.js';
import { ScoreboardService } from './ScoreboardService.js';
import { TournamentService } from './TournamentService.js';
import { AppContent } from '../types/AppContent.js';
import { Post } from '../types/Post.js';
import { Tournament } from '../types/Tournament.js';
import { PredictionEvent } from '../types/PredictionEvent.js';
import { ScoreboardEntry } from '../types/ScoreboardEntry.js';
import { Theme } from '../utils/getThemedColors.js';

/*
 * A service that handles the backend logic and data handling for the app
 */

export class Service {
  private readonly redis: RedisClient;
  private readonly reddit: RedditAPIClient;
  readonly settings: SettingsClient;
  readonly draft: DraftService;
  readonly post: PostService;
  readonly event: EventService;
  readonly scoreboard: ScoreboardService;
  readonly tournament: TournamentService;

  constructor(context: Context) {
    this.redis = context.redis;
    this.reddit = context.reddit;
    this.settings = context.settings;

    // Service submodules
    this.draft = new DraftService(context);
    this.post = new PostService(context);
    this.event = new EventService(context);
    this.scoreboard = new ScoreboardService(context);
    this.tournament = new TournamentService(context);
  }

  // Get app content
  async getAppContent(settings: {
    postId: string;
    userId?: string;
  }): Promise<AppContent | undefined> {
    const { postId, userId } = settings;

    const post: Post | undefined = (await this.post.get(postId)) ?? undefined;
    if (!post || post === undefined) {
      console.error('Post not found');
      return undefined;
    }

    const [
      tournament,
      scoreboardUser,
      scoreboard,
      seenIntro,
      userEvents,
      playerCount,
      appSettings,
    ]: [
      Tournament | undefined,
      { rank: number | null; score: number | null },
      ScoreboardEntry[],
      boolean,
      PredictionEvent[],
      number,
      SettingsValues
    ] = await Promise.all([
      await this.tournament.get(post.tournamentId),
      await this.scoreboard.getUser(post.tournamentId, userId),
      await this.scoreboard.getScoreboardUsers(post.tournamentId),
      await this.tournament.getIntroSeen(post.tournamentId, userId),
      await this.event.getUserEvents(post.tournamentId, userId),
      await this.scoreboard.getPlayerCount(post.tournamentId),
      await this.settings.getAll(),
    ]);
    if (!tournament) {
      console.error('Tournament not found');
      return undefined;
    }

    tournament.playerCount = playerCount;

    const postEvent = userEvents.find((event) => event.postId === postId);

    const user: {
      rank: number;
      score: number;
      hasPredicted: boolean;
      prediction: {
        optionId?: string;
        tokens?: number;
      };
      seenIntro: boolean;
    } = {
      rank: scoreboardUser.rank ?? 0,
      score: scoreboardUser.score ?? tournament.tokens,
      hasPredicted: postEvent !== undefined && postEvent.postId === postId,
      prediction: {
        optionId: postEvent?.optionId ?? undefined,
        tokens: postEvent?.tokens ?? undefined,
      },
      seenIntro,
    };

    // Add any user's actions to the tournament questions
    tournament.questions?.forEach((question, index) => {
      const match = userEvents.find((e) => e.postId === question.postId);

      const userEventMatch = {
        hasPredicted: match?.postId === postId,
        optionId: match?.optionId ?? undefined,
        tokens: match?.tokens ?? 0,
      };
      if (tournament.questions) {
        tournament.questions[index].user = userEventMatch;
      }
    });

    const appContent: AppContent = {
      post,
      user,
      scoreboard,
      tournament,
      settings: {
        theme: String(appSettings.theme) as Theme,
        tokenSymbol: String(appSettings.tokenSymbol),
      },
    };

    return appContent;
  }
}
