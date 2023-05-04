import { CommentContextActionEvent, Context, Devvit, KeyValueStorage, PostContextActionEvent, RedditAPIClient, UserContext, ConfigFormBuilder } from '@devvit/public-api';
import { Metadata } from '@devvit/protos';
const strikeMessages = {
    first: [
      "**Rule Violation: $REASON**",
      "",
      "We've been alerted to your activity on r/$SUBREDDIT that is considered violation of [Reddit’s Content Policy](https://www.redditinc.com/policies/content-policy) or [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).",
      "",
      "Before participating in r/$SUBREDDIT further, make sure you read and understand these rules.",
      "If you’re reported for any further violations of these rules, additional actions including banning may be taken against you.",
      "",
      "Community Rule:",
      "> 6.1.2. A serious violation of the rules includes all paragraphs from article 3, except the last one.",
      "> In case of such violation of the rules, the User is given only one warning.",
      "> For the second violation of the rules, a temporary ban of at least 15 days is applied to the User.",
      "> After the next violation, a ban of 30, 60 days and then a permaban is applied.",
      "",
      "r/$SUBREDDIT moderators",
      "",
      "---"
    ],
    second: [
        "**Rule Violation: $REASON**",
        "",
        "You've been temporarily banned from participating in r/$SUBREDDIT.",
        "",
        "Before participating in r/$SUBREDDIT further, make sure you read and understand [Reddit’s Content Policy](https://www.redditinc.com/policies/content-policy) and [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).",
        "",
        "Community Rule:",
        "> 6.1.2. A serious violation of the rules includes all paragraphs from article 3, except the last one.",
        "> In case of such violation of the rules, the User is given only one warning.",
        "> For the second violation of the rules, a temporary ban of at least 15 days is applied to the User.",
        "> After the next violation, a ban of 30, 60 days and then a permaban is applied.",
        "",
        "r/$SUBREDDIT moderators",
        "",
        "---"
    ],
    other: [
        "**Rule Violation: $REASON**",
        "",
        "You've been temporarily banned from participating in r/$SUBREDDIT.",
        "",
        "Before participating in r/$SUBREDDIT further, make sure you read and understand [Reddit’s Content Policy](https://www.redditinc.com/policies/content-policy) and [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).",
        "",
        "Community Rule:",
        "> 6.1.2. A serious violation of the rules includes all paragraphs from article 3, except the last one.",
        "> In case of such violation of the rules, the User is given only one warning.",
        "> For the second violation of the rules, a temporary ban of at least 15 days is applied to the User.",
        "> After the next violation, a ban of 30, 60 days and then a permaban is applied.",
        "",
        "r/$SUBREDDIT moderators",
        "",
        "---"
    ],
    removal: [
      "We have reviewed some things and have lifted your strike.",
      "",
      "For future reference, you can find helpful information by reviewing [Reddit’s Content Policy](https://www.redditinc.com/policies/content-policy) and [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).",
      "",
      "r/$SUBREDDIT moderators",
      "",
      "---"      
    ],
    /* reset: [
        "We have reviewed some things and have lifted all your strikes.",
        "",
        "For future reference, you can find helpful information by reviewing [Reddit’s Content Policy](https://www.redditinc.com/policies/content-policy) and [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).",
        "",
        "r/$SUBREDDIT moderators",
        "",
        "---"
    ], */
}

const reddit = new RedditAPIClient()
const kv = new KeyValueStorage();

class Strikes {
    public static getKeyForAuthor(author: string): string {
        return `u_${author}_strikes`;
    }
    public static async generateStrikeMessage(action: 'add' | 'remove'/*  | 'clear' */, metadata: { subreddit: string, name: string; reason?: string; strikes?: number; }) {
        let fileData: string;
        switch (action) {
            case 'add':
                switch (metadata.strikes) {
                    case 1:
                        fileData = strikeMessages['first'].join('\n');
                        break;
                     case 2:
                        fileData = strikeMessages['second'].join('\n');
                        break;
                    default:
                        fileData = strikeMessages['other'].join('\n');
                        break;
                }
                break;
            case 'remove':
                fileData = strikeMessages['removal'].join('\n');
                break;
            /* case 'clear':
                fileData = strikeMessages['reset'].join('\n');
                break; */
            default:
                return '';
        }

        return fileData
            .replace(/(\$STRIKES)/gmi, (metadata.strikes ?? 0).toString())
            .replace(/(\$SUBREDDIT)/gmi, metadata.subreddit)
            .replace(/(\$NAME)/gmi, metadata.name)
            .replace(/(\$REASON)/gmi, metadata.reason ?? '');
    }
    public static async getAuthorStrikes(author: string, metadata?: Metadata): Promise<number> {
        const key = Strikes.getKeyForAuthor(author);
        return (await kv.get(key, metadata, 0)) as number;
    }
    public static async checkStrikes(event: PostContextActionEvent | CommentContextActionEvent, metadata?: Metadata) {
        // Get some relevant data from the post or comment
        let author = (event.context === Context.POST ? event.post.author : event.comment.author);

        const strikes = await Strikes.getAuthorStrikes(author!, metadata);

        return { success: true, message: `u/${author} has ${strikes} strike${strikes !== 1 ? 's' : ''}.`, };
    }
    public static async setAuthorStrikes(author: string, strikes: number, metadata?: Metadata) {
        const key = Strikes.getKeyForAuthor(author);
        await kv.put(key, strikes, metadata);
    }
    public static async removeStrike(event: PostContextActionEvent | CommentContextActionEvent, metadata?: Metadata) {
        // Get some relevant data from the post or comment
        let author = (event.context === Context.POST ? event.post.author : event.comment.author);
        if (!author) return { success: false, message: `Could not get author of the comment or post`, };

        const subreddit = await reddit.getCurrentSubreddit(metadata);

        let strikes = await Strikes.getAuthorStrikes(author, metadata);

        if (strikes === 0) return { success: false, message: `u/${author} does not have any strikes for serious violation!`, };

        if (strikes >= 2) subreddit.getBannedUsers({ username: author }).children.filter((user) => user.username === author).forEach(async (user) => await subreddit.unbanUser(user.username));

        await Strikes.setAuthorStrikes(author, --strikes, metadata);

        const pmMessage = await Strikes.generateStrikeMessage('remove', { subreddit: subreddit.name, name: author, strikes, reason: 'N/A', });

        reddit.sendPrivateMessageAsSubreddit(
            {
                fromSubredditName: subreddit.name,
                to: author,
                subject: `Important notification about your activity on r/${subreddit.name}`,
                text: pmMessage,
            },
            metadata,
        )

        return { success: true, message: `Removed a strike from u/${author}. Remaining strikes: ${strikes}.`, };
    }
    public static async clearStrikes(event: PostContextActionEvent | CommentContextActionEvent, metadata?: Metadata) {
        // Get some relevant data from the post or comment
        let author = (event.context === Context.POST ? event.post.author : event.comment.author);
        if (!author) return { success: false, message: 'Could not get author of post or comment.', };

        const subreddit = await reddit.getCurrentSubreddit(metadata);

        const hadStrikes = await Strikes.getAuthorStrikes(author, metadata);

        if (hadStrikes === 0) return { success: false, message: `u/${author} does not have any strikes (for serious violation)!`, };

        if (hadStrikes >= 2) subreddit.getBannedUsers({ username: author }).children.filter((user) => user.username === author).forEach(async (user) => await subreddit.unbanUser(user.username));

        await Strikes.setAuthorStrikes(author, 0, metadata);

        return {
            success: true,
            message: `Cleared ${hadStrikes} strike${hadStrikes !== 1 ? 's' : ''} from u/${author}!`,
        };
    }
    public static async strike(event: PostContextActionEvent | CommentContextActionEvent, metadata?: Metadata) {
        const contextType = event.context

        let id: string | undefined, author: string | undefined, permalink: string | undefined;

         id = (event.context === Context.POST ? `t3_${event.post.id}` : `t1_${event.comment.id}`);
        author = (event.context === Context.POST ? event.post.author : event.comment.author);
        permalink = (event.context === Context.POST ? event.post.permalink : event.comment.permalink); 


        

        if (contextType === Context.POST) {
            id = `t3_${event.post.id}`;
            const post = await reddit.getPostById(id, metadata);
      
            if (!post) {
              return {
                success: false,
                message: `Could not get post with id ${id}!`,
              };
            }
      
            author = post.authorName;
            permalink = post.permalink;
          } else if (contextType === Context.COMMENT) {
            id = `t1_${event.comment.id}`;
            const comment = await reddit.getCommentById(id, metadata);
      
            if (!comment) {
              return {
                success: false,
                message: `Could not get comment with id ${id}`!,
              };
            }
      
            author = comment.authorName;
            permalink = comment.permalink;
          }

        const reason = event.userInput?.fields.find((f) => f.key === 'reason')?.response || '';

        await reddit.remove(id, false, metadata);

        let strikes = await Strikes.getAuthorStrikes(author!, metadata);
        await Strikes.setAuthorStrikes(author, ++strikes, metadata);

        let pmMessage = '';
        let punishment = '';
        let ban = true;
        let days = 0;

        const subreddit = await reddit.getCurrentSubreddit(metadata);

        switch (strikes) {
            case 1:
                // first strike, send a warning
                punishment = `sent a warning`;
                ban = false;
                break;
                case 2:
                  // second strike, temp ban, warn again
                  days = 15;
                  punishment = `banned for 15 days`;
                  break;
                case 3:
                  // third strike, temp ban, warn again
                  days = 30;
                  punishment = `banned for 30 days`;
                  break;
                default:
                  // fourth (and any subsequent strikes), ban for 60 days from now
                  days = 60;
                  punishment = `banned for 15 days`;
                  break;
              }
        pmMessage = await Strikes.generateStrikeMessage('add', { subreddit: subreddit.name, name: author, strikes, reason });

        await reddit.sendPrivateMessageAsSubreddit(
            {
                fromSubredditName: subreddit.name,
                to: author,
                subject: `Important notification about your activity on r/${subreddit.name}`,
                text: pmMessage,
            },
            metadata
        );

        const result = `u/${author} has ${strikes} strike${strikes !== 1 ? 's' : ''} and has been ${punishment}.`;

        if (ban) {
            const currentUser = await reddit.getCurrentUser(metadata);
            await reddit.banUser(
                {
                    subredditName: subreddit.name,
                    username: author,
                    duration: days,
                    context: id,
                    reason: `Received ${strikes} strike${strikes !== 1 ? 's' : ''} for serious violation of Community Rules`,
                    note: `Strike added by ${currentUser.username}`,
                },
                metadata
            );
        }

        return {
            success: true,
            message: result,
        };
    }

}

Devvit.addActions([
    {
        name: 'Remove and Strike (Serious)',
        description: 'Remove this and add a strike to the author',
        context: Context.POST,
        userContext: UserContext.MODERATOR,
        userInput: new ConfigFormBuilder().textarea('reason', 'Reason for strike').build(),
        
        handler: Strikes.strike,
    },
    {
        name: 'Remove and Strike (Serious)',
        description: 'Remove this and add a strike to the author',
        context: Context.COMMENT,
        userContext: UserContext.MODERATOR,
        userInput: new ConfigFormBuilder().textarea('reason', 'Reason for strike').build(),
        handler: Strikes.strike,
    },
    {
        name: `Check User's Strikes (Serious)`,
        description: 'Tells you how many strikes the author has',
        context: Context.POST,
        userContext: UserContext.MODERATOR,
        handler: Strikes.checkStrikes,
    },
    {
        name: `Check User's Strikes (Serious)`,
        description: 'Tells you how many strikes the author has',
        context: Context.COMMENT,
        userContext: UserContext.MODERATOR,
        handler: Strikes.checkStrikes,
    },
    {
        name: 'Remove one Strike (Serious)',
        description: 'Remove a strike from the author of this content',
        context: Context.POST,
        userContext: UserContext.MODERATOR,
        handler: Strikes.removeStrike,
    },
    {
        name: 'Remove one Strike (Serious)',
        description: 'Remove a strike from the author of this content',
        context: Context.COMMENT,
        userContext: UserContext.MODERATOR,
        handler: Strikes.removeStrike,
    },
    {
        name: 'Remove all strikes (Serious)',
        description: `Reset the author's strike count to zero`,
        context: Context.POST,
        userContext: UserContext.MODERATOR,
        handler: Strikes.clearStrikes,
    },
    {
        name: 'Remove all strikes (Serious)',
        description: `Reset the author's strike count to zero`,
        context: Context.COMMENT,
        userContext: UserContext.MODERATOR,
        handler: Strikes.clearStrikes,
    }
]);

export default Devvit;