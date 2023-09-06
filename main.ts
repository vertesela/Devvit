import {
  Devvit,
  MenuItemOnPressEvent,
  User,
} from '@devvit/public-api';

Devvit.configure({
  kvStore: true,
  redditAPI: true
});

/**
 * Creates a KVStore key for the author
 */
function getKeyForAuthor(author: User) {
  return `${author.id}_strikes`;
}

async function getThing(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { location, targetId } = event;
  const { reddit } = context;
  if (location === 'post') {
    return await reddit.getPostById(targetId);
  } else if (location === 'comment') {
    return await reddit.getCommentById(targetId);
  }
  throw 'Cannot find a post or comment with that ID';
}

async function getAuthor(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { reddit } = context;
  const thing = await getThing(event, context);
  return await reddit.getUserById(thing.authorId!);
}

async function getAuthorStrikes(author: User, context: Devvit.Context) {
  const { kvStore } = context;
  const key = getKeyForAuthor(author);
  return (await kvStore.get(key)) as number || 0;
}

async function checkStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const author = await getAuthor(event, context);
  const { ui } = context;
  const strikes = await getAuthorStrikes(author, context);
  ui.showToast(`Author u/${author.username} strike count: ${strikes}`);
}

async function setAuthorStrikes(author: User, strikes: number, context: Devvit.Context) {
  const { kvStore } = context;
  const key = getKeyForAuthor(author);
  await kvStore.put(key, strikes);
}

async function removeStrike(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Get some relevant data from the post or comment
  const author = await getAuthor(event, context);
  let strikes = await getAuthorStrikes(author, context);
  const { ui } = context;

  if (strikes > 0) {
    await setAuthorStrikes(author, --strikes, context);
    ui.showToast(`Removed a strike from u/${author.username}. Remaining strikes: ${strikes}.`);
    return;
  }

  ui.showToast(`u/${author.username} does not have any strikes!`);
}

async function clearStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Get some relevant data from the post or comment
  const author = await getAuthor(event, context);
  const hadStrikes = await getAuthorStrikes(author, context);
  const { ui } = context;

  if (hadStrikes > 0) {
    await setAuthorStrikes(author!, 0, context);
    ui.showToast(`Cleared ${hadStrikes} strike${hadStrikes !== 1 ? 's' : ''} from u/${author.username}!`);
    return;
  }

  ui.showToast(`u/${author.username} does not have any strikes!`);
}

async function strike(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */
  await thing!.remove();

  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);
  await setAuthorStrikes(author, ++strikes, context);

  // What we'll send the user in a private message
  let pmMessage = '';
  // Used to tell the moderator what punishment the user received
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;

  // Get the current subreddit from the metadata
  const subreddit = await reddit.getCurrentSubreddit();
  const { permalink } = thing;
  switch (strikes) {
    case 1:
      // first strike, send a warning
      pmMessage = 
      `**Warning for Serious Violation of Community Rules**`,
      ``,
      `We've been alerted to your activity on r/${subreddit.name} that is considered serious violation of [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).`,
      ``,
      `Link to reported content: ${permalink}`,
      ``,
      `Before participating in r/${subreddit.name} further, make sure you read and understand these rules.`,
      `If you’re reported for any further violations of these rules, additional actions including banning may be taken against you.`,
      ``,
      `**Community Rule:**`,
      `> 6.1.2. A serious rule violation includes rules 3.3 and 4. In case of such violation of the rules, the User is given only one warning.`, 
      `> In the case of a second violation of the rules, a temporary ban of at least 15 days is applied to the User, in this order, without future warnings: 15, 15, 30, 60 and further every 60 days.`, 
      `> Warnings for serious rule violations expire after 9 months.`,
      ``,
      `r/${subreddit.name} moderators`,
      ``,
      `---`;
      punishment = `sent a warning`;
      ban = false;
      break;

    case 2:
      // second strike, temp ban, warn again
      days = 15;
      pmMessage = 
      `**Rule Violation: Temporarily Banned for Serious Violation of Community Rules**`,
      ``,
      `You've been temporarily banned from participating in r/${subreddit.name}.`,
      ``,
      `Link to reported content: ${permalink}`,
      ``,
      `Before participating in r/${subreddit.name} further, make sure you read and understand [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).`,
      ``,
      `**Community Rule:**`,
      `> 6.1.2. A serious rule violation includes rules 3.3 and 4. In case of such violation of the rules, the User is given only one warning.`, 
      `> In the case of a second violation of the rules, a temporary ban of at least 15 days is applied to the User, in this order, without future warnings: 15, 15, 30, 60 and further every 60 days.`, 
      `> Warnings for serious rule violations expire after 9 months.`,
      ``,
      `r/${subreddit.name} moderators`,
      ``,
      `---`;

      punishment = `banned for 15 days`;
      break;

    case 3:
    days = 15;
    pmMessage = 
      `**Rule Violation: Temporarily Banned for Serious Violation of Community Rules**`,
      ``,
      `You've been temporarily banned from participating in r/${subreddit.name}.`,
      ``,
      `Link to reported content: ${permalink}`,
      ``,
      `Before participating in r/${subreddit.name} further, make sure you read and understand [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).`,
      ``,
      `**Community Rule:**`,
      `> 6.1.2. A serious rule violation includes rules 3.3 and 4. In case of such violation of the rules, the User is given only one warning.`, 
      `> In the case of a second violation of the rules, a temporary ban of at least 15 days is applied to the User, in this order, without future warnings: 15, 15, 30, 60 and further every 60 days.`, 
      `> Warnings for serious rule violations expire after 9 months.`,
      ``,
      `r/${subreddit.name} moderators`,
      ``,
      `---`;
     punishment = `banned for 15 days`;
     break;

    case 4:
      days = 30;
      pmMessage =
      `**Rule Violation: Temporarily Banned for Serious Violation of Community Rules**`,
      ``,
      `You've been temporarily banned from participating in r/${subreddit.name}.`,
      ``,
      `Link to reported content: ${permalink}`,
      ``,
      `Before participating in r/${subreddit.name} further, make sure you read and understand [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).`,
      ``,
      `**Community Rule:**`,
      `> 6.1.2. A serious rule violation includes rules 3.3 and 4. In case of such violation of the rules, the User is given only one warning.`, 
      `> In the case of a second violation of the rules, a temporary ban of at least 15 days is applied to the User, in this order, without future warnings: 15, 15, 30, 60 and further every 60 days.`, 
      `> Warnings for serious rule violations expire after 9 months.`,
      ``,
      `r/${subreddit.name} moderators`,
      ``,
      `---`;
      punishment = `banned for 30 days`;
      break;

    default:
      // fifth (and any subsequent strikes), ban for 60 days from now
      days = 60;
      pmMessage =
      `**Rule Violation: Temporarily Banned for Serious Violation of Community Rules**`,
      ``,
      `You've been temporarily banned from participating in r/${subreddit.name}.`,
      ``,
      `Link to reported content: ${permalink}`,
      ``,
      `Before participating in r/${subreddit.name} further, make sure you read and understand [Community Rules](https://www.reddit.com/r/croatia/wiki/subreddit_rules_en/).`,
      ``,
      `**Community Rule:**`,
      `> 6.1.2. A serious rule violation includes rules 3.3 and 4. In case of such violation of the rules, the User is given only one warning.`, 
      `> In the case of a second violation of the rules, a temporary ban of at least 15 days is applied to the User, in this order, without future warnings: 15, 15, 30, 60 and further every 60 days.`, 
      `> Warnings for serious rule violations expire after 9 months.`,
      ``,
      `r/${subreddit.name} moderators`,
      ``,
      `---`;
      punishment = `banned for 60 days`;
      break;
  }

  /**
   * Send a private message to the user
   * See: https://www.reddit.com/dev/api#POST_api_compose
   *
   * NOTE: Apps are executed as the moderator that installed this app into a
   *       subreddit and will be used as the user that sends this message!
   */
  await reddit.sendPrivateMessageAsSubreddit(
    {
      fromSubredditName: subreddit.name,
      to: author.username,
      subject: `Important notification about your activity on r/${subreddit.name}`,
      text: pmMessage,
    },
  );

  const result = `u/${author.username} strikes: ${strikes} and has been ${punishment}.`;

  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Received ${strikes} strike${strikes !== 1 ? 's' : ''
          } for breaking Community Rules`,
        note: `Strike added by ${currentUser.username}`,
      }
    );
  }

  ui.showToast(result);
}

/**
 * Declare our custom mod-only actions and add it to Posts and Comments
 */
Devvit.addMenuItem({
  label: 'Remove content (S)',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: strike,
});

Devvit.addMenuItem({
  label: `Check Strikes (S)`,
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: checkStrikes,
});

Devvit.addMenuItem({
  label: 'Remove Strike (S)',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: removeStrike,
});

/* Devvit.addMenuItem({ // no need for this
  label: 'Remove All Strikes from Author',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: clearStrikes,
}); */

export default Devvit;
