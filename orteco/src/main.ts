import { PostFlairUpdate, StickyRequest } from '@devvit/protos';
import {
  Devvit,
  MenuItemOnPressEvent,
  ModMailTrigger,
  ModMailConversationState,
  RedditAPIClient,
  ModAction,
  ModNote,
  ConversationUserData,
  Subreddit,
  ModMailActionType,
  PrivateMessage,
  WithUserData,
  ConversationResponse,
  ModMailService,
  AddRemovalNoteOptions,
  RemovalReason,
  MenuItemUserType,
  MenuItemLocation,
  MenuItem,
  TriggerContext,
  OnTriggerRequest,
  Comment,
  getModerationLog,
  FormOnSubmitEvent,
  Post,
  User,
  TriggerEvent
} from '@devvit/public-api';
import { makeCache } from '@devvit/public-api/devvit/internals/cache.js';
import { _namespaced } from '@devvit/public-api/devvit/internals/promise_cache.js';

import {isModerator, hasPerformedAction, hasPerformedActions, replacePlaceholders, getRecommendedPlaceholdersFromModAction, assembleRemovalReason, submitPostReply, ignoreReportsByPostId, setLockByPostId, isBanned} from "devvit-helpers";



Devvit.configure({
  kvStore: true,
  redditAPI: true,
  redis: false,
  modLog: false,
  realtime: true,
  http: true,
});
/* Devvit.addMenuItem({
  location: 'subreddit',
  label: 'Migrate KV Store to Redis Hash',
  onPress: async (_, {redis, ui, kvStore}) => {
    const keys = await kvStore.list()
    const hashKey = "custom_hash_key" // define your hash key here
    keys.forEach(async key => {
      const value = await kvStore.get(key)
      if (value) {
        console.log(`setting field: ${key} with value: ${value} in hash: ${hashKey}`)
        await redis.hset(hashKey, {[key]: value as string})
      }
    });
    // Verify the redis hash contents
    const items = await redis.hgetall(hashKey);
    if (items) {
      for (const key in items) {
        console.log(`redis hash contains field: ${key} and value: ${items[key]}`)
      }
    }
    // Now you can start using hget/hset methods for reads and writes
    // to the custom redis hash. And iterate with hscan, hgetall and hkeys.
    ui.showToast(`Completed redis hash migration`);
  },
});
 */
/**
 * Creates a KVStore key for the author
 */
function getKeyForAuthor(author: User) {
  return `${author.id}_strikes`; //dodan string
}

async function getThing(event: MenuItemOnPressEvent, context: Devvit.Context) { //promise
  const { location, targetId } = event;
  const { reddit } = context;
  console.log(`Provjera ID posta / komentara...`);
  if (location === 'post') {
    return await reddit.getPostById(targetId);
  } else if (location === 'comment') {
    return await reddit.getCommentById(targetId);
  }
  throw 'Cannot find a post or comment with that ID';
}

async function getAuthor(event: MenuItemOnPressEvent, context: Devvit.Context) { //promise
  const { reddit } = context;
  const thing = await getThing(event, context);
  return await reddit.getUserById(thing.authorId!);
}
// redis
/* async function getAuthorStrikes(author: User, context: Devvit.Context) {
  const { redis } = context;
  const key = getKeyForAuthor(author);
  return ((await redis.get(key)) || 0) as number;
} */


async function getAuthorStrikes(author: User, context: Devvit.Context) {
  const { kvStore } = context;
  const key = getKeyForAuthor(author);
  console.log(`Dohvaćanje kaznenih bodova ${author.username}...`);
  return (await kvStore.get(key)) as number || 0;
}

async function setAuthorStrikes(author: User, strikes: number, context: Devvit.Context) {
  const { kvStore } = context;
  const key = getKeyForAuthor(author);
  await kvStore.put(key, strikes);
}

// redis 

/* async function setAuthorStrikes(
  author: User,
  strikes: number,
  context: Devvit.Context
): Promise<void> {
  const { redis } = context;
  const subreddit = await context.reddit.getCurrentSubreddit();
  const currentUser = await context.reddit.getCurrentUser();
  const key = getKeyForAuthor(author);
  await redis.set(key, strikes.toString());
  await redis.expire(key, 120);
  await context.modLog
          .add({
            action: 'modmail_enrollment',
            target: author.id,
            details: `Point expired.`,
          })
          .catch((e: any) =>
            console.error(`Failed to add modlog for: ${author.id}.`, e.message)
          );

} */

async function checkStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const author = await getAuthor(event, context);
  const { ui } = context;
  const strikes = await getAuthorStrikes(author, context);
  
  console.log(`Provjera kaznenih bodova kod ${author.username}, ima ih ${strikes}...`);
  // Perform some action that changes the strikes (e.g., add points)

  ui.showToast(`u/${author.username} has ${strikes} negative point(s).`);

}

/* async function checkStrikes(event: MenuItemOnPressEvent, context: Devvit.Context): Promise<void> {
  const author = await getAuthor(event, context);
  const { ui } = context;
  const strikes = await getAuthorStrikes(author, context);
  console.log(`Provjera kaznenih bodova kod ${author.username}...`);
  ui.showToast(`u/${author.username} has ${strikes} negative point(s).`);
} */

async function removeStrike(event: MenuItemOnPressEvent, context: Devvit.Context): Promise<void> {
  // Get some relevant data from the post or comment
  const { reddit, ui } = context;
  const { location } = event;
  const author = await getAuthor(event, context);
  const currentUser = await reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const thing = await getThing(event, context);
  const { permalink } = thing;
  let strikes = await getAuthorStrikes(author, context);
  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();

  const comRuleLink = await context.settings.get<string>(('pravila'));
  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  const userIsBanned = bannedCheck.length > 0;
  await thing!.approve();
  await thing!.unlock();
  
  if (strikes > 0) {
    await setAuthorStrikes(author, --strikes, context);
    ui.showToast(`Negative point removed for u/${author.username} (${strikes}).`);
  
  
      var PenRemove = `Hello ${author.username},\n\n`;
  
      PenRemove += `We've recently flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
    
      PenRemove += `> ${contentB}\n\n`;
    
      PenRemove += `> https://reddit.com${permalink}\n\n\n`;
  
      PenRemove += `After reviewing, we found that the content wasn't in violation of community rules. As a result, your negative point has been lifted. We apologize for the mistake.\n\n`;
  
      PenRemove += `**Current number of your negative points: ${strikes}.**\n\n`;
  
      PenRemove += `For future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n`;
  
      PenRemove += `~ r/${subreddit.name} Mod Team\n\n`;
  
  
      var negRemove = `Hello ${author.username},\n\n`;
  
      negRemove += `We've recently flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
    
      negRemove += `> ${contentB}\n\n`;
    
      negRemove += `> https://reddit.com${permalink}\n\n\n`;
  
      negRemove += `After reviewing, we found that the content wasn't in violation of community rules. As a result, your negative point and ban have been lifted. We apologize for the mistake.\n\n`;
  
      negRemove += `**Current number of your negative points: ${strikes}.**\n\n`;
  
      negRemove += `For future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n`;
  
      negRemove += `~ r/${subreddit.name} Mod Team\n\n`;
  
  
      if (userIsBanned){ //unban, add mod mote and send msg
        await context.reddit.unbanUser(author.username, subreddit.name)
        await context.reddit.addModNote(
          {
            subreddit: subreddit.name,
            user: author.username,
            note: `${currentUser.username} removed the negative point (${strikes}).`,
            label: 'SPAM_WARNING',
            redditId: event.targetId
          }
        );
        await context.reddit.sendPrivateMessageAsSubreddit({
          fromSubredditName: subreddit.name,
          to: author.username,
          subject: `Important notification: your activity on r/${subreddit.name}`,
          text: negRemove,
          });
      }
      else { //if user is not banned, add mod note and send msg
        await context.reddit.addModNote(
          {
            subreddit: subreddit.name,
            user: author.username,
            note: `${currentUser.username} removed the negative point (${strikes}).`,
            label: 'SPAM_WARNING',
            redditId: event.targetId
          }
        );
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: author.username,
        subject: `Important notification: your activity on r/${subreddit.name}`,
        text: PenRemove,
      });
      }
    } 
      else {
        return ui.showToast("Oops, error!");
      };
  

  console.log(`${currentUser.username} uklanja kazneni bod korisniku ${author.username}.`);
  if (location === 'post'){
      await context.modLog
        .add({
          action: 'approvelink',
          target: thing!.id,
          details: `Restored a post and removed the negative point.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing.id}.`, e.message)
        );
      }
      else {
        await context.modLog
        .add({
          action: 'approvecomment',
          target: thing!.id,
          details: `Restored a comment and removed the negative point.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
}

async function remove3Strikes(event: MenuItemOnPressEvent, context: Devvit.Context): Promise<void> {
  // Get some relevant data from the post or comment
  const { reddit, ui } = context;
  const { location } = event;
  const author = await getAuthor(event, context);
  const currentUser = await reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const thing = await getThing(event, context);
  const { permalink } = thing;
  let strikes = await getAuthorStrikes(author, context);
  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();

  const comRuleLink = await context.settings.get<string>(('pravila'));
  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  const userIsBanned = bannedCheck.length > 0;

    await thing!.approve();
    await thing!.unlock();

    var PenRemove = `Hello ${author.username},\n\n`;

    PenRemove += `We've recently flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
    PenRemove += `> ${contentB}\n\n`;
  
    PenRemove += `> https://reddit.com${permalink}\n\n\n`;

    PenRemove += `After reviewing, we found that the content wasn't in violation of community rules. As a result, three negative points have been lifted. We apologize for the mistake.\n\n`;

    PenRemove += `**Current number of your negative points: ${strikes - 3}.**\n\n`;

    PenRemove += `For future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n`;

    PenRemove += `~ r/${subreddit.name} Mod Team\n\n`;


    var negRemove = `Hello ${author.username},\n\n`;

    negRemove += `We've recently flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
    negRemove += `> ${contentB}\n\n`;
  
    negRemove += `> https://reddit.com${permalink}\n\n\n`;

    negRemove += `After reviewing, we found that the content wasn't in violation of community rules. As a result, three negative points and ban have been lifted. We apologize for the mistake.\n\n`;

    negRemove += `**Current number of your negative points: ${strikes - 3}.**\n\n`;

    negRemove += `For future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n`;

    negRemove += `~ r/${subreddit.name} Mod Team\n\n`;

  if (strikes > 0) {
    await setAuthorStrikes(author, strikes - 3, context);
    ui.showToast(`Three negative points removed from u/${author.username} (${strikes - 3}).`);

    if (userIsBanned){
      await context.reddit.unbanUser(author.username, subreddit.name)
      await context.reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author.username,
          note: `${currentUser.username} removed 3 negative points (${strikes - 3}).`,
          label: 'SPAM_WARNING',
          redditId: event.targetId
        }
      );
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: author.username,
        subject: `Important notification: your activity on r/${subreddit.name}`,
        text: negRemove,
        });
      }
      else {
        await context.reddit.addModNote(
          {
            subreddit: subreddit.name,
            user: author.username,
            note: `${currentUser.username} removed 3 negative points (${strikes - 3}).`,
            label: 'SPAM_WARNING',
            redditId: event.targetId
          }
        );
      await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: author.username,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: PenRemove,
      })
    };
  }

  console.log(`${currentUser.username} uklanja 3 kaznena boda korisniku ${author.username}...`);
  if (location === 'post'){
    await context.modLog
      .add({
        action: 'approvelink',
        target: thing!.id,
        details: `Restored a post and removed 3 negative points.`,
      })
      .catch((e: any) =>
        console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
      );
    }
    else {
      await context.modLog
      .add({
        action: 'approvecomment',
        target: thing!.id,
        details: `Restored a comment and removed 3 negative points.`,
      })
      .catch((e: any) =>
        console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
      );
    }
}

async function clearStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { reddit, ui } = context;
  const author = await getAuthor(event, context);
  const currentUser = await reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const thing = await getThing(event, context);
  let strikes = await getAuthorStrikes(author, context);

  if (strikes > 0) {
    await setAuthorStrikes(author!, 0, context);
    ui.showToast(`Uklonjen broj negativnih bodova kod u/${author.username}: ${strikes}!`);
    return;
  }

  await context.reddit.addModNote(
    {
      subreddit: subreddit.name,
      user: author.username,
      note: `${currentUser.username} removed ${strikes} negative point(s).`,
      label: 'SPAM_WARNING',
      redditId: event.targetId
    }
  );

  ui.showToast(`u/${author.username} nema negativnih bodova!`);
}

async function remImpersonation(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */
    


  const RemRev = await context.settings.get<string>(('reasonImpersonation'));
  const comRuleLink = await context.settings.get<string>(('pravila'));
  const ImpRule = await context.settings.get<string>(('ImpersonationRule'));
  const flairImper = await context.settings.get<string>(('flairImp'));


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;


  var logImp = `Hello ${author.username},\n\n`;
  
  logImp += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logImp += `However, we've flagged your username as a rule violation - [impersonation](https://support.reddithelp.com/hc/en-us/articles/360043075032-Do-not-impersonate-an-individual-or-entity).\n\n\n`;
    
  logImp += `As a result, we are removing the content and permanently banning you in accordance with rule 4.3.\n\n\n`;

  logImp += `We don't allow usernames impersonating public figures because it can lead to confusion, misrepresentation, and potential legal issues. It's important to maintain authenticity and respect for individuals within our community.\n\n`;
  
  logImp += `**Reminder:**\n\n`;

  logImp += `> ${ImpRule}\n\n`; 

  logImp += `We understand that errors can occur, and if you believe a mistake has been made, you have the right to appeal within 3 days.\n\n`;
  
  logImp += `~ r/${subreddit.name} Mod Team\n\n`;


  if (!userIsBanned){

  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }

  await reddit.sendPrivateMessageAsSubreddit(
    {
      fromSubredditName: subreddit.name,
      to: author.username,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logImp,

    },
    );
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        message: `Ban in accordance with rule 4.3. due to impersonation. Please read the second message for more details.`,
        reason: `Impersonation`,
        note: `Ban in accordance with rule 4.3. due to impersonation (mod: ${currentUser.username}).`,
      }
    );

    if (location === 'post') {
      reddit.setPostFlair({
        subredditName: subreddit.name,
        postId: thing!.id,
        flairTemplateId: flairImper,
      })
    }
  
  
    console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
      if (location === 'post'){
        await context.modLog
          .add({
            action: 'removelink',
            target: thing!.id,
            details: `Removed a post and banned a user for impersonation.`,
          })
          .catch((e: any) =>
            console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
          );
        }
        else {
          await context.modLog
          .add({
            action: 'removecomment',
            target: thing!.id,
            details: `Removed a comment and banned a user for impersonation.`,
          })
          .catch((e: any) =>
            console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
          );
        }
        return ui.showToast(`u/${author.username} is banned for impersonation.`);
  }
  else {
    await thing!.remove();
    await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  return ui.showToast(`User is already banned!`);

  };

}

async function remBadUsername(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */
    


  const RemRev = await context.settings.get<string>(('reasonImpersonation'));
  const comRuleLink = await context.settings.get<string>(('pravila'));
  const ImpRule = await context.settings.get<string>(('ImpersonationRule'));
  const flairImper = await context.settings.get<string>(('flairImp'));


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;


  var logImp = `Hello ${author.username},\n\n`;
  
  logImp += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logImp += `However, we've flagged your username as a rule violation.\n\n\n`;
    
  logImp += `As a result, we are removing the content and permanently banning you in accordance with rule 4.3.\n\n\n`;

  logImp += `We don't allow bad usernames or any that promote hate speech, as they violate our community guidelines and can create a hostile environment. Unfortunately, since username changes aren't possible, we must enforce a permaban in this case.\n\n`;
  
  logImp += `**Reminder:**\n\n`;

  logImp += `> ${ImpRule}\n\n`; 

  logImp += `We understand that errors can occur, and if you believe a mistake has been made, you have the right to appeal within 3 days.\n\n`;
  
  logImp += `~ r/${subreddit.name} Mod Team\n\n`;


  if (!userIsBanned){

  await thing!.remove();
  await thing!.lock();
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }

  await reddit.sendPrivateMessageAsSubreddit(
    {
      fromSubredditName: subreddit.name,
      to: author.username,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logImp,

    },
    );
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        message: `Ban in accordance with rule 4.3. due to bad username. Please read the second message for more details.`,
        reason: `Bad username`,
        note: `Ban in accordance with rule 4.3. due to bad username (mod: ${currentUser.username}).`,
      }
    );

    if (location === 'post') {
      reddit.setPostFlair({
        subredditName: subreddit.name,
        postId: thing!.id,
        flairTemplateId: flairImper,
      })
    }
  
  
    console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
      if (location === 'post'){
        await context.modLog
          .add({
            action: 'removelink',
            target: thing!.id,
            details: `Removed a post and banned a user for bad username.`,
          })
          .catch((e: any) =>
            console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
          );
        }
        else {
          await context.modLog
          .add({
            action: 'removecomment',
            target: thing!.id,
            details: `Removed a comment and banned a user for bad username.`,
          })
          .catch((e: any) =>
            console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
          );
        }
        return ui.showToast(`u/${author.username} is banned for bad username.`);
  }
  else {
    await thing!.remove();
    await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  return ui.showToast(`User is already banned!`);

  };

}

async function remHarassment(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */
    


  const RemRev = await context.settings.get<string>(('reasonHarassment'));
  const comRuleLink = await context.settings.get<string>(('pravila'));


  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);
  // const now = new Date().getTime();


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new



  // What we'll send the user in a private message
;
  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  // Get the current subreddit from the metadata
  const { permalink } = thing;
  const genRule = await context.settings.get<string>(('generalRule'));

  var logHa = `Hello ${author.username},\n\n`;
  
  logHa += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logHa += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logHa += `> ${contentB}\n\n`;
  
  logHa += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logHa += `**Reason**: [Harassment](https://support.reddithelp.com/hc/en-us/articles/360043071072) | [Threatening violence](https://support.reddithelp.com/hc/en-us/articles/360043513151) | [Hate](https://support.reddithelp.com/hc/en-us/articles/360045715951)\n\n`;
    
  logHa += `As a result, we are issuing you three negative points, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 3}.**\n\n\n`;
  
  logHa += `**Reminder:**\n\n`;

  logHa += `> ${genRule}\n\n`; 

  logHa += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logHa += `~ r/${subreddit.name} Mod Team\n\n`;
    

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes + 3) {
      
      case 1:
        logHa;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logHa;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logHa;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logHa;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logHa;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logHa;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logHa;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logHa;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logHa;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logHa;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logHa;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logHa;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logHa;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logHa;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logHa;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes + 3}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};
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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logHa,

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        message: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points. Please read the second message for more details.`,
        reason: `Harassment`,
        note: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
     context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 negative points for harassment (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }

  const flairHarr = await context.settings.get<string>(('flairHarr'));


  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairHarr,
    })
  }
  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    if (location === 'post'){
      await context.modLog
        .add({
          action: 'removelink',
          target: thing!.id,
          details: `Removed a post and added 3 negative points for harassment.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
      else {
        await context.modLog
        .add({
          action: 'removecomment',
          target: thing!.id,
          details: `Removed a comment and added 3 negative points for harassment.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
}

async function remEvasion(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */

  const RemRev = await context.settings.get<string>(('reasonEvasion'));
  const comRuleLink = await context.settings.get<string>(('pravila'));

  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new



  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;



  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const genRule = await context.settings.get<string>(('generalRule'));

  var logEv = `Hello ${author.username},\n\n`;
  
  logEv += `Your [submission](https://reddit.com${permalink}) has been identified as an instance of [ban evasion](https://support.reddithelp.com/hc/en-us/articles/360043504811-What-is-Ban-Evasion-), so you've received three negative points for violating [site-wide rule 2](https://www.redditinc.com/policies/content-policy).\n\n\n`;
  
  logEv += `**Negative Point(s):** ${strikes + 3}\n\n\n`;
        
  logEv += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logEv += `**Reminder:**\n\n`;

  logEv += `> ${genRule}\n\n`;  
    
  logEv += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days.\n\n`;
    
  logEv += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional negative point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logEv += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }

    switch (strikes + 3) {
      
      case 1:
        logEv;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logEv;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logEv;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logEv;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logEv;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logEv;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logEv;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logEv;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logEv;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logEv;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logEv;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logEv;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logEv;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logEv;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logEv;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes + 3}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};
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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logEv,

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Ban Evasion`,
        message: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points. Please read the second message for more details.`,
        note: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 negative points for Ban Evasion (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
  if (location === 'post'){
    await context.modLog
      .add({
        action: 'modmail_enrollment',
        target: thing!.id,
        details: `Added 3 negative points for Ban Evasion.`,
      })
      .catch((e: any) =>
        console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
      );
    }
    else {
      await context.modLog
      .add({
        action: 'modmail_enrollment',
        target: thing!.id,
        details: `Added 3 negative points for Ban Evasion.`,
      })
      .catch((e: any) =>
        console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
      );
    }
}

async function remVM(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */

  const RemRev = await context.settings.get<string>(('reasonVM'));
  const comRuleLink = await context.settings.get<string>(('pravila'));

  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;

  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const genRule = await context.settings.get<string>(('generalRule'));

  var logVM = `Hello ${author.username},\n\n`;

  logVM += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logVM += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logVM += `> ${contentB}\n\n`;
  
  logVM += `Link to removed content: https://reddit.com${permalink}\n\n\n`;
  
  logVM += `**Reason**: [Vote manipulation](https://support.reddithelp.com/hc/en-us/articles/360043066412)\n\n`;
  
  logVM += `As a result, we are issuing you three negative points, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 3}.**\n\n\n`;
  
  logVM += `**Reminder:**\n\n`;

  logVM += `> ${genRule}\n\n`; 

  logVM += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logVM += `~ r/${subreddit.name} Mod Team\n\n`;
  

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes + 3) {
      
      case 1:
        logVM;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logVM;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logVM;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logVM;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logVM;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logVM;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logVM;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logVM;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logVM;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logVM;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logVM;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logVM;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logVM;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logVM;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logVM;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes + 3}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};
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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logVM,

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Vote manipulation`,
        message: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points. Please read the second message for more details.`,
        note: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 negative points for vote manipulation (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
  if (location === 'post'){
    await context.modLog
      .add({
        action: 'removelink',
        target: thing!.id,
        details: `Removed a post and added 3 negative points for vote manipulation.`,
      })
      .catch((e: any) =>
        console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
      );
    }
    else {
      await context.modLog
      .add({
        action: 'removecomment',
        target: thing!.id,
        details: `Removed a comment and added 3 negative points for vote manipulation.`,
      })
      .catch((e: any) =>
        console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
      );
    }

}

async function remSpam(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */

  const RemRev = await context.settings.get<string>(('reasonSpam'));
  const comRuleLink = await context.settings.get<string>(('pravila'));

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new



  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;


  // Get the current subreddit from the metadata
  const { permalink } = thing;
  const genRule = await context.settings.get<string>(('generalRule'));

  var logS = `Hello ${author.username},\n\n`;
  
  logS += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logS += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logS += `> ${contentB}\n\n`;
  
  logS += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logS += `**Reason**: [Spam](https://support.reddithelp.com/hc/en-us/articles/360043504051)\n\n`;
    
  logS += `As a result, we are issuing you three negative points, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 3}.**\n\n\n`;
  
  logS += `**Reminder:**\n\n`;

  logS += `> ${genRule}\n\n`; 

  logS += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logS += `~ r/${subreddit.name} Mod Team\n\n`;      
  

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes + 3) {
      
      case 1:
        logS;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logS;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logS;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logS;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logS;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logS;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logS;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logS;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logS;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logS;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logS;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logS;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logS;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logS;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logS;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes + 3}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};
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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logS,

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Spam`,
        message: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points. Please read the second message for more details.`,
        note: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 negative points for spamming (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    if (location === 'post'){
      await context.modLog
        .add({
          action: 'removelink',
          target: thing!.id,
          details: `Removed a post and added 3 negative points for spamming.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
      else {
        await context.modLog
        .add({
          action: 'removecomment',
          target: thing!.id,
          details: `Removed a comment and added 3 negative points for spamming.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
}

async function remDoxxing(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */

  const RemRev = await context.settings.get<string>(('reasonDoxxing'));
  const comRuleLink = await context.settings.get<string>(('pravila'));


  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);
  const now = new Date().getTime();


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  // What we'll send the user in a private message
  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;


  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const genRule = await context.settings.get<string>(('generalRule'));

  var logDo = `Hello ${author.username},\n\n`;
  
  logDo += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logDo += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logDo += `> ${contentB}\n\n`;
  
  logDo += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logDo += `**Reason**: [Personal and confidental information](https://support.reddithelp.com/hc/en-us/articles/360043066452)\n\n`;
    
  logDo += `As a result, we are issuing you three negative points, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 3}.**\n\n\n`;
  
  logDo += `**Reminder:**\n\n`;

  logDo += `> ${genRule}\n\n`; 

  logDo += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logDo += `~ r/${subreddit.name} Mod Team\n\n`;
  
  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes + 3) {
      
      case 1:
        logDo;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logDo;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logDo;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logDo;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logDo;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logDo;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logDo;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logDo;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logDo;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logDo;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logDo;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logDo;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logDo;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logDo;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logDo;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes + 3}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};
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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logDo,

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Doxxing`,
        message: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points. Please read the second message for more details.`,
        note: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 negative points for doxxing (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }

  const flairPriv = await context.settings.get<string>(('flairPriv'));


  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairPriv,
    })
  }

  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    if (location === 'post'){
      await context.modLog
        .add({
          action: 'removelink',
          target: thing!.id,
          details: `Removed a post and added 3 negative points for doxxing.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
      else {
        await context.modLog
        .add({
          action: 'removecomment',
          target: thing!.id,
          details: `Removed a comment and added 3 negative points for doxxing.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }

}

async function remIllegal(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */

  const RemRev = await context.settings.get<string>(('reasonIllegal'));
  const comRuleLink = await context.settings.get<string>(('pravila'));

  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);
  const now = new Date().getTime();


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;

  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const genRule = await context.settings.get<string>(('generalRule'));

  var logIll = `Hello ${author.username},\n\n`;
  
  logIll += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logIll += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logIll += `> ${contentB}\n\n`;
  
  logIll += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logIll += `**Reason**: [Illegal or Probihited Transactions](https://support.reddithelp.com/hc/en-us/articles/360043513471)\n\n`;
    
  logIll += `As a result, we are issuing you three negative points, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 3}.**\n\n\n`;
  
  logIll += `**Reminder:**\n\n`;

  logIll += `> ${genRule}\n\n`; 

  logIll += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logIll += `~ r/${subreddit.name} Mod Team\n\n`;
  
  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes + 3) {
      
      case 1:
        logIll;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logIll;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logIll;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logIll;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logIll;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logIll;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logIll;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logIll;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logIll;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logIll;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logIll;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logIll;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logIll;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logIll;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logIll;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes + 3}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};
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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logIll,

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        message: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points. Please read the second message for more details.`,
        context: thing!.id,
        reason: `Illegal content`,
        note: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 negative points for illegal content (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }

  const flairIllegal = await context.settings.get<string>(('flairIllegal'));


  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairIllegal,
    })
  }
  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    if (location === 'post'){
      await context.modLog
        .add({
          action: 'removelink',
          target: thing!.id,
          details: `Removed a post and added 3 negative points for illegal content.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
      else {
        await context.modLog
        .add({
          action: 'removecomment',
          target: thing!.id,
          details: `Removed a comment and added 3 negative points for illegal content.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
}

async function remBreaking(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */

  const RemRev = await context.settings.get<string>(('reasonBreaking'));
  const comRuleLink = await context.settings.get<string>(('pravila'));


  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);
  const now = new Date().getTime();


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;


  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const genRule = await context.settings.get<string>(('generalRule'));

  var logBr = `Hello ${author.username},\n\n`;
  
  logBr += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logBr += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logBr += `> ${contentB}\n\n`;
  
  logBr += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logBr += `**Reason**: [Breaking the Site](https://support.reddithelp.com/hc/en-us/articles/360043512931)\n\n`;
    
  logBr += `As a result, we are issuing you three negative points, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 3}.**\n\n\n`;
  
  logBr += `**Reminder:**\n\n`;

  logBr += `> ${genRule}\n\n`; 

  logBr += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logBr += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes + 3) {
      
      case 1:
        logBr;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logBr;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logBr;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logBr;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logBr;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logBr;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logBr;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logBr;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logBr;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logBr;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logBr;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logBr;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logBr;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logBr;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logBr;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes + 3}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};
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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logBr,

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Breaking the site`,
        message: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points. Please read the second message for more details.`,
        note: `Ban in accordance with rule 4.2. due to ${strikes + 3} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 negative points for breaking the site (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    if (location === 'post'){
      await context.modLog
        .add({
          action: 'removelink',
          target: thing!.id,
          details: `Removed a post and added 3 negative points for breaking the site.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
      else {
        await context.modLog
        .add({
          action: 'removecomment',
          target: thing!.id,
          details: `Removed a comment and added 3 negative points for breaking the site.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
}

async function remEtiquette(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  const modB = 'orteco';
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */

  const RemRev = await context.settings.get<string>(('reasonEtiquette'));
  const comRuleLink = await context.settings.get<string>(('pravila'));


  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);
  const now = new Date().getTime();


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;


  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;


  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const ruleEtiq = await context.settings.get<string>(('textetiq'));
  const ruleEtiq2 = await context.settings.get<string>(('textetiq2'));
  const genRule = await context.settings.get<string>(('generalRule'));

  var logEtt = `Hello ${author.username},\n\n`;
  
  logEtt += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logEtt += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logEtt += `> ${contentB}\n\n`;
  
  logEtt += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logEtt += `**Reason**:\n\n`;
  
  logEtt += `> ${ruleEtiq}\n\n`;

  logEtt += `> ${ruleEtiq2}\n\n`;
  
  logEtt += `As a result, we are issuing you one negative point, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 1}.**\n\n\n`;
  
  logEtt += `**Reminder:**\n\n`;

  logEtt += `> ${genRule}\n\n`; 

  logEtt += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logEtt += `~ r/${subreddit.name} Mod Team\n\n`;


  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes) {
      
      case 1:
        logEtt;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logEtt;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logEtt;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logEtt;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logEtt;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logEtt;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logEtt;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logEtt;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logEtt;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logEtt;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logEtt;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logEtt;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logEtt;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logEtt;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logEtt;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};

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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logEtt,

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Insulting`,
        message: `Ban in accordance with rule 4.2. due to ${strikes} negative points. Please read the second message for more details.`,
        note: `Ban in accordance with rule 4.2. due to ${strikes} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a negative point for insulting (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
  const flairEtt = await context.settings.get<string>(('flairEtt'));

  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairEtt,
    })
  }
  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    if (location === 'post'){
      await context.modLog
        .add({
          action: 'removelink',
          target: thing!.id,
          details: `Removed a post and added a negative point for insulting.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
      else {
        await context.modLog
        .add({
          action: 'removecomment',
          target: thing!.id,
          details: `Removed a comment and added a negative point for insulting.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }

      /* async function autoRemovePoint(event: MenuItemOnPressEvent, context: Devvit.Context) {

        function threeDaysLaterSameTime(): Date {
          // Get current date and time
          const now = new Date();
          
          // Add three days
          const threeDaysLater = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
      
          // Set hours, minutes, and seconds to match current time
          threeDaysLater.setHours(now.getHours());
          threeDaysLater.setMinutes(now.getMinutes());
          threeDaysLater.setSeconds(now.getSeconds());
      
          return threeDaysLater;
      };

        const whenStr = threeDaysLaterSameTime;
        if (!whenStr) {
          context.ui.showToast("I don't know when to remind you!");
          return;
        }
        const now = new Date();
        const currentUser = await context.reddit.getCurrentUser();
      
      
      Devvit.addSchedulerJob({
        name: REMIND_ME_ACTION_NAME,
        onRun: async (event, context) => {
          const { userId, postId, fromWhen } = event.data!;
      
          const user = await context.reddit.getUserById(userId);
          const post = await context.reddit.getPostById(postId);
          let strikes = await getAuthorStrikes(author, context);
      
        await setAuthorStrikes(author, --strikes, context);
      
          /**
           * Send a private message to the user:
           */
        /*  await context.reddit.sendPrivateMessage({
            to: user.username,
            subject: 'RemindMe',
            text: `Beep boop! You asked me to remind you about [${post.title}](${post.permalink}) at ${fromWhen}!`,
          });
        },
      });
      
        await context.scheduler.runJob({
          name: REMIND_ME_ACTION_NAME,
          data: {
            userId: currentUser.id,
            postId: context.postId,
            fromWhen: now,
          },
          runAt: threeDaysLaterSameTime(),
      
        });
      
        const author = await getAuthor(event, context);
        let strikes = await getAuthorStrikes(author, context);
      
        await setAuthorStrikes(author, --strikes, context);
      } 
      */
    };

async function remNonO(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */


  const RemRev = await context.settings.get<string>(('reasonNoN'));
  const comRuleLink = await context.settings.get<string>(('pravila'));


  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);
  const now = new Date().getTime();


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;

  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;


  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const ruleNoN = await context.settings.get<string>(('textNoN'));
  const genRule = await context.settings.get<string>(('generalRule'));

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  var logNoN = `Hello ${author.username},\n\n`;

  logNoN += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logNoN += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logNoN += `> ${contentB}\n\n`;
  
  logNoN += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logNoN += `**Reason**:\n\n`;
  
  logNoN += `> ${ruleNoN}\n\n`;
  
  logNoN += `As a result, we are issuing you one negative point, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 1}.**\n\n\n`;
  
  logNoN += `**Reminder:**\n\n`;

  logNoN += `> ${genRule}\n\n`; 

  logNoN += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logNoN += `~ r/${subreddit.name} Mod Team\n\n`;


  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes) {
      
      case 1:
        logNoN;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logNoN;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logNoN;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logNoN;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logNoN;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logNoN;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logNoN;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logNoN;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logNoN;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logNoN;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logNoN;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logNoN;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logNoN;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logNoN;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logNoN;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};

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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logNoN,

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Non-obscured private info`,
        message: `Ban in accordance with rule 4.2. due to ${strikes} negative points. Please read the second message for more details.`,
        note: `Ban in accordance with rule 4.2. due to ${strikes} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a negative point for posting non-obscured private info (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }

  const flairNoN = await context.settings.get<string>(('flairNoN'));


  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairNoN,
    })
  }
  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    if (location === 'post'){
      await context.modLog
        .add({
          action: 'removelink',
          target: thing!.id,
          details: `Removed a post and added a negative point for posting non-obscured private info.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
      else {
        await context.modLog
        .add({
          action: 'removecomment',
          target: thing!.id,
          details: `Removed a comment and added a negative point for posting non-obscured private info.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }

}

async function remKmecanje(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */
  // if (!thing!.isRemoved){};

  const RemRev = await context.settings.get<string>(('reasonKmecanje'));
  const comRuleLink = await context.settings.get<string>(('pravila'));

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;

  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;


  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;


  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const ruleKme = await context.settings.get<string>(('textKmecanje'));
  const genRule = await context.settings.get<string>(('generalRule'));


  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  var logKM = `Hello ${author.username},\n\n`;

  logKM += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logKM += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logKM += `> ${contentB}\n\n`;
  
  logKM += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logKM += `**Reason**:\n\n`;
  
  logKM += `> ${ruleKme}\n\n`;
  
  logKM += `As a result, we are issuing you one negative point, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 1}.**\n\n\n`;
  
  logKM += `**Reminder:**\n\n`;

  logKM += `> ${genRule}\n\n`; 

  logKM += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logKM += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes) {
      
      case 1:
        logKM;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logKM;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logKM;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logKM;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logKM;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logKM;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logKM;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logKM;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logKM;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logKM;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logKM;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logKM;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logKM;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logKM;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logKM;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();

  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};
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
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logKM

    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Kmečanje`,
        message: `Ban in accordance with rule 4.2. due to ${strikes} negative points. Please read the second message for more details.`,
        note: `Ban in accordance with rule 4.2. due to ${strikes} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a negative point for the mod discussion (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }

  const flairKmecanje = await context.settings.get<string>(('flairKmecanje'));


  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairKmecanje,
    })
  }
  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    if (location === 'post'){
      await context.modLog
        .add({
          action: 'removelink',
          target: thing!.id,
          details: `Removed a post and added a negative point for the mod discussion.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }
      else {
        await context.modLog
        .add({
          action: 'removecomment',
          target: thing!.id,
          details: `Removed a comment and added a negative point for the mod discussion.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }

}

async function remOfftopic(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

  /**
   * Remove the content
   * See: https://www.reddit.com/dev/api#POST_api_remove
   *
   * NOTE: Apps are executed as the moderator that installed this app and
   *       must have permission to remove content for this to work!
   */

  const RemRev = await context.settings.get<string>(('reasonOfftopic'));
  const comRuleLink = await context.settings.get<string>(('pravila'));


  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author, context);
  const now = new Date().getTime();


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  //await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new

  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

  // What we'll send the user in a private message
  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;


  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const ruleOff = await context.settings.get<string>(('ruleOff'));
  const genRule = await context.settings.get<string>(('generalRule'));


  //let msgOff = '';
  // const warnMessage = await context.settings.get<Paragraph>('log-alert');

 // const poOff = await context.settings.get<('pointsOff');

 const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;


  var logOff = `Hello ${author.username},\n\n`;
  
  logOff += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logOff += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logOff += `> ${contentB}\n\n`;
  
  logOff += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logOff += `**Reason**:\n\n`;
  
  logOff += `> ${ruleOff}\n\n`;
  
  logOff += `As a result, we are issuing you one negative point, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 1}.**\n\n\n`;
  
  logOff += `**Reminder:**\n\n`;

  logOff += `> ${genRule}\n\n`; 

  logOff += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logOff += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
    switch (strikes) {
      
      case 1:
        logOff;
        punishment = `warned`;
        ban = false;
        break;    
  
     case 2:
        logOff;
        punishment = `warned`;
        ban = false;
        break;
        
      case 3:
        logOff;
        punishment = `warned`;
        ban = false;
        break;
        
      case 4:
        logOff;
        punishment = `warned`;
        ban = false;
        break;
  
      case 5:
        days = 5;
        logOff;
        punishment = `banned for 5 days`;
        break;
  
      case 6:
        days = 5;
        logOff;
        punishment = `banned for 5 days`;
        break;
  
      case 7:
        days = 5;
        logOff;
        punishment = `banned for 5 days`;
        break;
  
      case 8:
        days = 5;
        logOff;
        punishment = `banned for 5 days`;
        break;
  
      case 9:
        days = 5;
        logOff;
        punishment = `banned for 5 days`;
        break;

      case 10:
        days = 10;
        logOff;
        punishment = `banned for 10 days`;
        break;

      case 11:
        days = 10;
        logOff;
        punishment = `banned for 10 days`;
        break;

      case 12:
        days = 10;
        logOff;
        punishment = `banned for 10 days`;
        break;

      case 13:
        days = 10;
        logOff;
        punishment = `banned for 10 days`;
        break;

      case 14:
        days = 10;
        logOff;
        punishment = `banned for 10 days`;
        break;

        default:
        days = 15;
        logOff;
        punishment = `banned for 15 days`;
        break;
  }
  const result = `${author.username} is ${punishment} (${strikes}).`;
   ui.showToast(result);
}
else {
  await thing!.remove();
  await thing!.lock();
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  const alert = `Content has been removed, but points are not added because ${author.username} is already banned or already sanctioned for this. Please check in the mod log if ${author.username} has already been sanctioned for this and if the user has already been banned - if not - approve this content, then repeat the sanctioning.`;
  console.log(`${currentUser.username} uklanja sadržaj, korisnik ${author.username} je već baniran.`);
  return ui.showToast(alert);
};
  /**
   * Send a private message to the user
   * See: https://www.reddit.com/dev/api#POST_api_compose
   *
   * NOTE: Apps are executed as the moderator that installed this app into a
   *       subreddit and will be used as the user that sends this message!
   */
  // const textM: string = await context.settings.get<string>('poruka');
  
  await reddit.sendPrivateMessageAsSubreddit(
    {
      fromSubredditName: subreddit.name,
      to: author.username,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logOff,
    },
    );
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Offtopic/troll content`,
        message: `Ban in accordance with rule 4.2. due to ${strikes} negative points. Please read the second message for more details.`,
        note: `Ban in accordance with rule 4.2. due to ${strikes} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a negative point due to offtopic/troll comment (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
  console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    if (location === 'comment'){
        await context.modLog
        .add({
          action: 'removecomment',
          target: thing!.id,
          details: `Removed a comment and added a negative point due to offtopic/troll comment.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${thing!.id}.`, e.message)
        );
      }

}

async function silentPointAdd(event: MenuItemOnPressEvent, context: Devvit.Context) {
    // Use the correct term in our message based on what was acted upon
    const { location } = event;
    const { reddit, ui } = context;
    const thing = await getThing(event, context);
    const author = await getAuthor(event, context);
    const subreddit = await reddit.getCurrentSubreddit();
    const currentUser = await reddit.getCurrentUser();
// Add a strike to the user and persist it to the KVStore
    let strikes = await getAuthorStrikes(author, context);
    await setAuthorStrikes(author, ++strikes, context);

    
    // Get the current subreddit from the metadata
    const result = `Silently added negative point (${strikes}).`;
  
    /* if (addModNote) {
      const currentUser = await reddit.getCurrentUser();
      await reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author.username,
          note: `Strike added by ${currentUser.username}`,
          label: 'SPAM_WARNING',
          redditId: ''
        }
      );
    } */
    ui.showToast(result);

    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} has silently added a negative point (${strikes}).`,
        label: 'SPAM_WATCH',
        redditId: event.targetId
      }
    );
}

async function silentPointRemove(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Get some relevant data from the post or comment
  const { reddit, ui } = context;
  const author = await getAuthor(event, context);
  const currentUser = await reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const thing = await getThing(event, context);
  const { permalink } = thing;
  let strikes = await getAuthorStrikes(author, context);
  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;
    
  if (strikes > 0) {
    await setAuthorStrikes(author, --strikes, context);
    ui.showToast(`Silently removed a negative point from u/${author.username} (${strikes}).`);
  
    if (userIsBanned){ //unban, add mod mote and send msg
      //await context.reddit.unbanUser(author.username, subreddit.name)
      await context.reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author.username,
          note: `${currentUser.username} has silently removed a negative point (${strikes}).`,
          label: 'SPAM_WARNING',
          redditId: event.targetId
        }
      );
    }
    else { //if user is not banned, add mod note and send msg
      await context.reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author.username,
          note: `${currentUser.username} has silently removed a negative point (${strikes}).`,
          label: 'SPAM_WARNING',
          redditId: event.targetId
        }
      );
    }
  }
}

Devvit.addTrigger({
  event: 'ModAction',
  async onEvent(event, context) {
  
    const subreddit = await context.reddit.getCurrentSubreddit();

    console.log(`Received ModAction trigger event:\n${JSON.stringify(event)}`);

      if (!event.actionedAt){
        console.error('Error');
        return;
      }
      let actionedAT: Date = event!.actionedAt;
      // Convert the date to GMT+1 timezone
      
      let options: Intl.DateTimeFormatOptions = {
      timeZone: 'Europe/Paris', // GMT+1 timezone
      hour12: false// Use 24-hour format
      };

      let createdAtGMTPlusOne: string = actionedAT.toLocaleString('en-US', options);

      if (!(event.moderator?.name == ("AutoModerator")) && event.action == ("approvelink")) {
        console.log('Found approvelink action by mod...');

        const postLink = event.targetPost?.permalink;
        const postAuthor = event.targetUser!.name;
        const comRuleLink = await context.settings.get<string>(('pravila'));


        var textMsg = `Hi u/${postAuthor},\n\n`;
        textMsg += `We would like to inform you that your [post](${postLink}) has now been approved by moderators.\n\n`,
        textMsg += `For future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n`;
        textMsg += `~ r/${subreddit.name} Mod Team\n\n`;


        await context.reddit.sendPrivateMessageAsSubreddit({
          fromSubredditName: subreddit.name,
          to: postAuthor,
          subject: `Important notification: your activity on r/${subreddit.name}`,
          text: textMsg
        })
        console.log(`Message sent to ${postAuthor}!`);

      }
      else {
        console.log(`Not approval action, ignoring..`);
      }
    }
  }
  );

Devvit.addTrigger({
  event: 'ModAction',
  async onEvent(event, context) {
  
    const subreddit = await context.reddit.getCurrentSubreddit();
    const webhook = await context?.settings.get('webhook') as string;

    console.log(`Received ModAction trigger event:\n${JSON.stringify(event)}`);

    if (!event.moderator){
      console.log("No moderator found in event.");
      return;
    }

    try {

      if (!event.actionedAt){
        console.error('Error');
        return;
      }
      let actionedAT: Date = event!.actionedAt;
      // Convert the date to GMT+1 timezone
      
      let options: Intl.DateTimeFormatOptions = {
      timeZone: 'Europe/Paris', // GMT+1 timezone
      hour12: false// Use 24-hour format
      };

      let createdAtGMTPlusOne: string = actionedAT.toLocaleString('en-US', options);

      if (!(event.moderator.name == ("self-ban")) && event.action == ("banuser")) {

      console.log('Found banuser action by mod...')

      let payload;

      if (!webhook) {
        console.error('No webhook URL provided');
        return;
      }
      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        if (discordRole) {
            discordAlertMessage = `<@&${discordRole}> **Hey mods, ${event.moderator.name} has banned ${event.targetUser?.name}!**\n\n`;
            discordAlertMessage += `You can check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&actions=BAN_USER).\n\n\n`;
        } else {
          discordAlertMessage = `**Hey mods, ${event.moderator.name} has banned ${event.targetUser?.name}!**\n\n`;
            discordAlertMessage += `You can check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&actions=BAN_USER).\n\n\n`;
        }
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
      {
        fields: [
          {
            name: 'Subreddit',
            value: `r/${subreddit.name}`,
            inline: true,
          },
          {
            name: 'Moderator',
            value: `${event.moderator.name}`,
            inline: true,
          },
          {
            name: 'Target User',
            value: `${event.targetUser?.name}`,
            inline: true,
          },
          {
            name: 'Action',
            value: `Ban`,
            inline: true,
          },
          {
            name: 'Timestamp',
            value: `${createdAtGMTPlusOne}`,
            inline: true,
          },
        ],
      },
    ]
  }

  try {
    // Send alert to Discord
    await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    console.log("Alert sent to Discord!");

    await context.modLog
        .add({
          action: 'modmail_enrollment',
          target: event.targetUser?.id,
          details: `Alert sent to Discord`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${event.targetUser?.id}.`, e.message)
        );

  } catch (err) {
    console.error(`Error sending alert: ${err}`);
    await context.modLog
        .add({
          action: 'modmail_enrollment',
          target: event.targetUser?.id,
          details: `Error sending alert to Discord`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${event.targetUser?.id}.`, e.message)
        );
  }
  return;
        };
}

  else {
    console.log("Not a ban, ignoring...");
  }
  
} catch(error) {
  console.error('Error getting mod logs:', error);
}
}
});

export enum SettingName{
  LegitUsers = "legitUsers",
};

Devvit.addSettings([
  {
    name: SettingName.LegitUsers,
    type: "string",
    label: "A list of beta users",
  },
  {
    type: 'string',
    name: 'webhook',
    label: 'Webhook URL (Discord)',
  },
  {
    type: 'string',
    name: 'discordRole',
    label: 'Role ID to ping',
  },
  {
  type: 'string',
  name: 'flairEtt',
  label: 'Flair ID for insulting',
},
{ 
  type: 'string',
  name: 'flairNoN',
  label: 'Flair ID for non-obscured private info',
},
{ 
  type: 'string',
  name: 'flairKmecanje',
  label: 'Flair ID for mod topic',
},
{
  type: 'string',
  name: 'flairHarr',
  label: 'Flair ID for harassment',
},
{
  type: 'string',
  name: 'flairPriv',
  label: 'Flair ID for doxxing',
},
{
  type: 'string',
  name: 'flairIllegal',
  label: 'Flair ID for illegal content',
},
{
  type: 'string',
  name: 'flairImp',
  label: 'Flair ID for impersonation',
},
{
  type: 'string',
  name: 'flairRep',
  label: 'Flair ID for repost',
},
{
  type: 'string',
  name: 'reasonEtiquette',
  label: 'Removal reason ID for insulting',
},
{
  type: 'string',
  name: 'reasonOfftopic',
  label: 'Removal reason ID for offtopic/troll content',
},
{
  type: 'string',
  name: 'reasonNoN',
  label: 'Removal reason ID for non-obscured private info',
},
{
  type: 'string',
  name: 'reasonKmecanje',
  label: 'Removal reason ID for mod topic',
},
{
  type: 'string',
  name: 'reasonHarassment',
  label: 'Removal reason ID for harassment',
},
{
  type: 'string',
  name: 'reasonDoxxing',
  label: 'Removal reason ID for doxxing',
},
{
  type: 'string',
  name: 'reasonIllegal',
  label: 'Removal reason ID for illegal content',
},
{
  type: 'string',
  name: 'reasonBreaking',
  label: 'Removal reason ID for breaking the site',
},
{
  type: 'string',
  name: 'reasonEvasion',
  label: 'Removal reason ID for ban evasion',
},
{
  type: 'string',
  name: 'reasonVM',
  label: 'Removal reason ID for vote manipulation',
},
{
  type: 'string',
  name: 'reasonSpam',
  label: 'Removal reason ID for spam',
},
{
  type: 'string',
  name: 'reasonImpersonation',
  label: 'Removal reason ID for impersonation',
},
{
  type: 'string',
  name: 'textetiq',
  label: 'Rule for insulting',
},
{
  type: 'string',
  name: 'textetiq2',
  label: 'Rule for insulting 2',
},
{
  type: 'string',
  name: 'ruleOff',
  label: 'Rule for offtopic/troll content',
},
{
  type: 'string',
  name: 'textNoN',
  label: 'Rule for non-obscured private info',
},
{
  type: 'string',
  name: 'textKmecanje',
  label: 'Rule for mod topic',
},
{
  type: 'string',
  name: 'generalRule',
  label: 'General rule',
},
{
  type: 'string',
  name: 'ImpersonationRule',
  label: 'Rule 4.3.',
},
{
  type: 'string',
  name: 'pravila',
  label: 'Link to community rules',
},
{
  type: 'string',
  name: 'verFlair',
  label: 'Verified User Flair ID'
},
{
  type: 'number',
  name: 'minComKOG',
  label: 'Minimum comment karma (for original account)',
  defaultValue: 1,
},
]);


Devvit.addMenuItem({
  label: '3. Non-obscured PI', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to non-obscuring private info.',
  onPress: remNonO,
});



Devvit.addMenuItem({
  label: '4. Harassment', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to harassment.',
  onPress: remHarassment,
});

Devvit.addMenuItem({
  label: '5. Doxxing', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to doxxing.',
  onPress: remDoxxing,
});

Devvit.addMenuItem({
  label: '6. Illegal content', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Removal of illegal content.',
  onPress: remIllegal,
});

Devvit.addMenuItem({
  label: '7.1. Ban evasion', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to Ban Evasion.',
  onPress: remEvasion,
});

Devvit.addMenuItem({
  label: '8. Breaking the site', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to breaking the site.',
  onPress: remBreaking,
});

Devvit.addMenuItem({
  label: '9. Spam', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to spamming.',
  onPress: remSpam,
});

Devvit.addMenuItem({
  label: '9.3. Impersonation', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to impersonation.',
  onPress: remImpersonation,
});

Devvit.addMenuItem({
  label: '9.5. Bad username', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to bad username.',
  onPress: remBadUsername,
});

Devvit.addMenuItem({
  label: '1. Insult',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal for insulting.',
  onPress: remEtiquette,
});

Devvit.addMenuItem({
  label: '2. Mod Topic',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Mod topic removal.',
  onPress: remKmecanje,
});

Devvit.addMenuItem({
  label: '2.2. Offtopic',
  location: ['comment'],
  forUserType: 'moderator',
  description: 'Removal of frivolous comment from SERIOUS or Mod Thread.',
  onPress: remOfftopic,
});

Devvit.addMenuItem({
  label: 'PP: Silent add', //Silent strike (add strike, but without notification & ban), we use it for importing strikes for earlier violations
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Use only for the purpose of migration of previous violations. No notification, no ban.',
  onPress: silentPointAdd,
});

Devvit.addMenuItem({
  label: 'PP: Silent remove', //Silent strike (add strike, but without notification & ban), we use it for importing strikes for earlier violations
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Remove point without notification.',
  onPress: silentPointRemove,
});

Devvit.addMenuItem({
  label: `PP: Check`, // Check the number of author's strikes
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Checking how many negative points the User has.',
  onPress: checkStrikes,
});

Devvit.addMenuItem({
  label: 'PP: Remove', //Remove strike from that user
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Use only when reversing a minor violation. The User will be notified.',
  onPress: removeStrike,
  });

Devvit.addMenuItem({
  label: 'PP: Remove 3',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Use only when reversing a medium violation. The User will be notified.',
  onPress: remove3Strikes,
});

const chatWaitList = Devvit.createForm(
  {
    title: 'Chat Waitlist',
    fields: [
      {
        name: 'chatWT',
        label: `Potvrđujem da ću poštivati pravila i upoznat sam s činjenicom da me Vijeće moderatora može sankcionirati ukoliko ne poštujem ista.`,
        type: 'boolean',
      },
    ],
    acceptLabel: 'Ok',
  },
  async (_event, context) => {
    const { reddit, ui } = context;    
    const subreddit = await reddit.getCurrentSubreddit();
    const currentUser = await reddit.getCurrentUser();
    const bannedCheck = await reddit.getBannedUsers({
      subredditName: subreddit.name,
      username: currentUser.username,
    }).all();
    const userIsBanned = bannedCheck.length > 0;

    const comRuleLink = await context.settings.get<string>(('pravila'));

  const genRule = await context.settings.get<string>(('generalRule'));

  var logWT = `Hello ${currentUser.username},\n\n`;
  
  logWT += `Thank you for expressing your interest in participating in the r/croatia chat channels. We've added you to our waitlist, and you'll be among the first to gain access once we have the option for manual user approval.\n\n\n`;
      
  logWT += `We appreciate your patience and look forward to welcoming you to our community chat channels soon. If you have any further questions, feel free to reach out.\n\n`;
 
  logWT += `Cheers,\n\n`;
  
  logWT += `r/${subreddit.name} Mod Team\n\n`;


  if (!_event.values.chatWT){
    const result = `Jebiga, moraš se složit s pravilima!`;
   ui.showToast(result);
  }
  else {
    await reddit.sendPrivateMessageAsSubreddit(
    {
      fromSubredditName: subreddit.name,
      to: currentUser.username,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logWT,

    },
    );

  const result = `Dodan/a si na waitlistu!`;
   ui.showToast(result);

  };
}
);

Devvit.addMenuItem({
  location: 'subreddit',
  label: 'Chat Waitlist',
  onPress: async (_event, context) => {
    const { ui } = context;
    ui.showForm(chatWaitList);
  },
});

const chatAc = Devvit.createForm(
  {
    title: 'Chats',
    fields: [
      {
        name: `userA`,
        helpText: 'Username',
        label: 'Author',
        type: 'string',
        required: true,
      },
      {
        name: 'noteU',
        helpText: 'Note to user',
        label: 'Note',
        type: 'string',
        required: true,
      },
    ],
    acceptLabel: 'Ok',
  },
  async (_event, context) => {
    const { reddit, ui } = context;    
    const author = _event.values.userA;
    const subreddit = await reddit.getCurrentSubreddit();
    const currentUser = await reddit.getCurrentUser();
    const bannedCheck = await reddit.getBannedUsers({
      subredditName: subreddit.name,
      username: author,
    }).all();
    const userIsBanned = bannedCheck.length > 0;

    const comRuleLink = await context.settings.get<string>(('pravila'));

  const genRule = await context.settings.get<string>(('generalRule'));

  var logVM = `Hello ${author},\n\n`;
  
  logVM += `You've received negative point(s) for violating our [Community Rules](${comRuleLink}) in chat channels.\n\n\n`;
      
  logVM += `**Reason**: ${_event.values.noteU}\n\n`;
      
  logVM += `**Understanding the Rules**\n\n\n`;
  
  logVM += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logVM += `**Reminder:**\n\n`;

  logVM += `> ${genRule}\n\n`;  
  
  logVM += `**Appeal Process**\n\n\n`;
  
  logVM += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days.\n\n`;
    
  logVM += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional negative point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logVM += `~ r/${subreddit.name} Mod Team\n\n`;

  const result = `${author} is warned.`;
   ui.showToast(result);
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
      to: author,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: logVM,

    },
    );
  }
);

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Chat',
  onPress: async (_event, context) => {
    const { ui } = context;
    ui.showForm(chatAc);
  },
});


const ModernCro = Devvit.createForm(
  {
    title: 'Pozivnica za ModernCroatia',
    fields: [
      {
        name: `userA`,
        helpText: 'Username',
        label: 'Korisnik',
        type: 'string',
        required: true,
      },
    ],
    acceptLabel: 'Ok',
  },
  async (_event, context) => {
    const { reddit, ui } = context;    
    const author = _event.values.userA;
    const subreddit = await reddit.getCurrentSubreddit();
    const currentUser = await reddit.getCurrentUser();
    const bannedCheck = await reddit.getBannedUsers({
      subredditName: subreddit.name,
      username: author,
    }).all();

  var logMod = `Bok,\n\n`;
  
  logMod += `Javljamo se jer smo prepoznali korisnike na r/${subreddit.name} koji bi mogli biti dobri za doprinos ove zajednice, a mi smo svojom internom evalucijom na temelju tvoje aktivnosti, iskusnosti i poštivanju pravila zaključili da bi mogao/la pomoći u poboljšanju kvalitete subreddita kroz ideje, prijedloge i iskustva kroz sudjelovanje u zatvorenoj zajednici.\n\n\n`;
            
  logMod += `Ukoliko si zainteresiran/a ili imaš kakvih pitanja, slobodno nam javi.\n\n\n`;
  
  logMod += `Lijep pozdrav,\n\n`;
  
  logMod += `~ Moderacija r/${subreddit.name}\n\n`;

  const result = `Poslana poruka korisniku ${author}.`;

   ui.showToast(result);
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
      to: author,
      subject: `Poziv za sudjelovanje u poboljšanju kvalitete r/${subreddit.name}`,
      text: logMod,

    },
    );
  }
);

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'ModernCroatia',
  onPress: async (_event, context) => {
    const { ui } = context;
    ui.showForm(ModernCro);
  },
});

const checkPoints = Devvit.createForm(
  {
    title: 'Provjera negativnih bodova',
    description: `Odaberi što želiš da potvrda sadržava.`,
    fields: [
      {
        name: 'prNeg',
        label: 'Broj negativnih bodova',
        type: 'boolean',
      },
      {
        name: `remCo`,
        label: 'Uklonjeni komentari na ovom subredditu',
        type: 'boolean',
      },
    ],
    acceptLabel: 'Pošalji zahtjev',
  },
  async (_event, context) => {
    const { reddit, ui } = context;    
    const subreddit = await reddit.getCurrentSubreddit();
    const currentUser = await reddit.getCurrentUser();
    const strikes = await getAuthorStrikes(currentUser, context);
    console.log(`${currentUser.username} provjerava svoj broj negativnih bodova.`);
  
  
      const userComments = await currentUser.getComments({
        sort: "new",
        limit: 100
    }).all();

    var numberOfRemovedCommentsToInclude = 5;

    if (!_event.values.prNeg && !_event.values.remCo){ // bodovi 0, komentari 0
      return ui.showToast(`Zahtjev nije predan, moraš označiti barem jednu stavku.`);
    };

    if (!_event.values.prNeg && _event.values.remCo){ // bodovi 0, komentari 1
      var textLL = `Bok ${currentUser.username}, u nastavku je popis tvojih nedavno uklonjenih komentara na r/${subreddit.name}.\n\n`;

      if (numberOfRemovedCommentsToInclude > 0)
    {
        const filteredComments = userComments
            .filter(x => x.removed && x.locked && x.subredditName == subreddit.name)
            .slice(0, numberOfRemovedCommentsToInclude);
  
        if (filteredComments.length > 0)
  
        {  
            for (const comment of filteredComments)
            {
                textLL += `[${comment.createdAt.toLocaleDateString()}](${comment.permalink}):\n\n`
                textLL += `> ${comment.body.split("\n\n").join("\n\n> ")}\n\n`; // string.replaceAll not available without es2021
            }
  
            textLL += "---\n\n";
        }
    }
    textLL += `Imaj na umu da je ova opcija još u razvoju. Ukoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.\n\n`;
  
  
    await context.reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: currentUser.username,
        subject: `Zahtjev za pristup podacima: r/${subreddit.name}`,
        text: textLL,
      }
    )
    };

  if (_event.values.prNeg && !_event.values.remCo) { // bodovi 1, komentari 0
    if (strikes > 0) {
  
      var textLL = `Bok ${currentUser.username}, broj tvojih negativnih bodova na r/${subreddit.name} je ${strikes}.\n\n`;
  
      } else {
        textLL = `Bok ${currentUser.username}, dobre vijesti - trenutno nemaš negativnih bodova na r/${subreddit.name}.\n\nUkoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.\n\n`;
      }
    
      ui.showToast(`Potvrda poslana.`);    
    
      await context.reddit.sendPrivateMessageAsSubreddit(
        {
          fromSubredditName: subreddit.name,
          to: currentUser.username,
          subject: `Zahtjev za pristup podacima: r/${subreddit.name}`,
          text: textLL,
        }
      )
    };

    if (_event.values.prNeg && _event.values.remCo) { // bodovi 1, komentari 1
    if (strikes > 0) {
  
    var textLL = `Bok ${currentUser.username}, broj tvojih negativnih bodova na r/${subreddit.name} je ${strikes}.\n\n`;

    } else {
      textLL = `Bok ${currentUser.username}, dobre vijesti - trenutno nemaš negativnih bodova na r/${subreddit.name}.\n\nUkoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.\n\n`;
    }
  
    ui.showToast(`Potvrda poslana.`);
     
    if (numberOfRemovedCommentsToInclude > 0)
    {
        const filteredComments = userComments
            .filter(x => x.removed && x.locked && x.subredditName == subreddit.name)
            .slice(0, numberOfRemovedCommentsToInclude);
  
        if (filteredComments.length > 0)
  
        {
            textLL += `**Tvoji nedavno uklonjeni komentari na r/${subreddit.name}**:\n\n`;
  
            for (const comment of filteredComments)
            {
                textLL += `[${comment.createdAt.toLocaleDateString()}](${comment.permalink}):\n\n`
                textLL += `> ${comment.body.split("\n\n").join("\n\n> ")}\n\n`; // string.replaceAll not available without es2021
            }
  
            textLL += "---\n\n";
        }
    }
    textLL += `Imaj na umu da je ova opcija još u razvoju. Ukoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.\n\n`;
  
  
    await context.reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: currentUser.username,
        subject: `Zahtjev za pristup podacima: r/${subreddit.name}`,
        text: textLL,
      }
    )

  };

  
  }
);


Devvit.addMenuItem({
  label: 'Provjera negativnih bodova', //User option, how many strikes I have, sends a message
  location: ['subreddit'],
  description: 'Mogućnost provjere negativnih bodova iz moderatorske evidencije. ',
  onPress: async (_event, context) => {
    const { ui } = context;
    ui.showForm(checkPoints);
  },
 }
);


 Devvit.addTrigger({
  event: 'ModMail',
  async onEvent(event, context) {
  
    console.log(`Received modmail trigger event:\n${JSON.stringify(event)}`);

    try {
    if (event.messageAuthor?.name.includes('orteco')) {
      console.log(`Archiving bot message conversation with ID: ${event.conversationId}`);
      
      await context.reddit.modMail.archiveConversation(event.conversationId);
      
      console.log(`Archived bot message conversation with ID: ${event.conversationId} successfully`);
    } else {
      console.log('Skipped archiving: Author or subject conditions not met.');
    }
  } catch (error) {
    console.error('Error archiving bot messages:', error);
  }
}
}
);


const approvalUs = Devvit.createForm(
  {
    title: 'Throwaway account approval form',
    fields: [
      {
        name: `origU`,
        label: 'Original account',
        type: 'string',
        helpText: 'The username of the original account omitting the u/',
        required: true,
      },
      {
      name: `throwU`,
      label: 'Throwaway account',
      type: 'string',
      helpText: 'The username of the throwaway account omitting the u/',
      required: true,
    }
    ],
    acceptLabel: 'Approve',
  },
  async (_event, context) => {
    const { reddit, ui, redis } = context; 
    const origAcc = await reddit.getUserByUsername(_event.values.origU);
    const throwAcc = await reddit.getUserByUsername(_event.values.throwU);
    const subreddit = await reddit.getCurrentSubreddit();
    const bannedCheck = await reddit.getBannedUsers({
      subredditName: subreddit.name,
      username: origAcc.username,
    }).all();

    const bannedthCheck = await reddit.getBannedUsers({
      subredditName: subreddit.name,
      username: throwAcc.username,
    }).all();
    const userIsBanned = bannedCheck.length > 0;
    const throwIsBanned = bannedthCheck.length > 0;

    const minComKO = await context.settings.get<number>(('minComKOG'));

    const verifiedFlair = await context.settings.get<string>(('verFlair'));
  

  var logMod = `Hello ${origAcc.username},\n\n`;

  logMod += `Great news - we've approved your throwaway account u/${throwAcc.username} on r/${subreddit.name}!\n\n`;

  logMod += `If this request was made in error or if you have any questions, feel free to reach out.\n\n\n`;
      
  logMod += `~ r/${subreddit.name} Mod Team\n\n`;

  /////////////////////////////////////////////////////

  var logTr = `Hello ${throwAcc.username},\n\n`; // throwaway
  
  logTr += `We wanted to inform you that u/${origAcc.username} has requested to use this account as a throwaway for participation on r/${subreddit.name}.\n\n\n`;
           
  logTr += `This throwaway account is now approved on r/${subreddit.name}\n\n`;

  logTr += `If this request was made in error or if you have any questions, feel free to reach out.\n\n\n`;
    
  logTr += `~ r/${subreddit.name} Mod Team\n\n`;


  ///////////////////

  var logPot = `Hello ${origAcc.username},\n\n`; // decline (throwaway)
  
  logPot += `We wanted to inform you that your request has been declined because your throwaway account u/${throwAcc.username} is banned on r/${subreddit.name}.\n\n\n`;
         
  logPot += `If this request was made in error or if you have any questions, feel free to reach out.\n\n\n`;

  logPot += `~ r/${subreddit.name} Mod Team\n\n`;


  ///////////////////////////////////

  var logOrg = `Hello ${origAcc.username},\n\n`; // decline (main)
  
  logOrg += `We wanted to inform you that your request has been declined because your account u/${origAcc.username} does not meet the requirements.\n\n\n`;

  logOrg += `If this request was made in error or if you have any questions, feel free to reach out.\n\n\n`;

  logOrg += `~ r/${subreddit.name} Mod Team\n\n`;


  /**
   * Send a private message to the user
   * See: https://www.reddit.com/dev/api#POST_api_compose
   *
   * NOTE: Apps are executed as the moderator that installed this app into a
   *       subreddit and will be used as the user that sends this message!
   */

  if (!minComKO) {
    console.error("Undefined data");
    return;
  }

  if (!userIsBanned && (origAcc.commentKarma > minComKO)) {
    console.log(`Verification of the main account u/${origAcc.username} ok, meets all criteria - comment karma: ${origAcc.commentKarma} > ${minComKO}`);

    if (!throwIsBanned) {
      console.log(`Verification of the throwaway account u/${throwAcc.username} ok, meets all criteria.`);
    await reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: origAcc.username,
        subject: `Important notification: your activity on r/${subreddit.name}`,
        text: logMod,
      },
      );
      console.log(`Message to main account was sent.`);

    await reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: throwAcc.username,
        subject: `Important notification: your activity on r/${subreddit.name}`,
        text: logTr,
      },
      );
      console.log(`Message to throwaway account was sent.`);
      const result = `Approved!`;
      ui.showToast(result);

      await reddit.setUserFlair({
        subredditName: subreddit.name,
        username: throwAcc.username,
        flairTemplateId: verifiedFlair,
      })
    }

    else {
      await reddit.sendPrivateMessageAsSubreddit(
        {
          fromSubredditName: subreddit.name,
          to: origAcc.username,
          subject: `Important notification: your activity on r/${subreddit.name}`,
          text: logPot,
        },
        );
        console.log(`Verification of the main account u/${throwAcc.username} failed, doesn't meet all criteria.`);
      const result = `That throwaway account does not meet the requirements!`;
      ui.showToast(result);
      }

    }
    else {
      await reddit.sendPrivateMessageAsSubreddit(
        {
          fromSubredditName: subreddit.name,
          to: origAcc.username,
          subject: `Important notification: your activity on r/${subreddit.name}`,
          text: logOrg,
        },
        );
        console.log(`Verification of the main account u/${origAcc.username} failed, doesn't meet all criteria - comment karma: ${origAcc.commentKarma} > ${minComKO}`);
        const result = `Original account does not meet the requirements.`;
      ui.showToast(result);
    }
  }
);

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  // forUserType: 'moderator',
  label: 'Throwaway',
  description: 'Throwaway account approval form',
  onPress: async (_event, context) => {
    const { ui } = context;
    ui.showForm(approvalUs);
  },
});


const contentDashboardP = Devvit.createForm(
  (data) => ({
    fields: [
      {
        name: `origU`,
        label: 'Author',
        type: 'string',
        defaultValue: data.author,
        disabled: true
      },
      {
        name: `postLink`,
        label: 'Link',
        type: 'string',
        defaultValue: `https://reddit.com${data.link}`,
        disabled: true
      },
      {
      name: `score`,
      label: 'Score',
      type: 'number',
      defaultValue: data.postScore,
      disabled: true
    },
    {
      name: `numOfReports`,
      label: 'Number of reports',
      type: 'number',
      defaultValue: data.reportsNum,
      disabled: true
    },
    ],
    title: 'Content Dashboard',
  }),

  async (event, context) => {}
);

Devvit.addMenuItem({
  location: ['post'],
  label: 'Post Dashboard',
  description: 'More details about post',
  onPress: async (event, context) => {
    const { ui } = context;
    const { location } = event;

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();

    const originalPost = context.postId!;
    const getPost = await context.reddit.getPostById(originalPost);
    const author = getPost.authorName;    
    const postLink = getPost.permalink;
    const score = getPost.score;
    const numOfReports = getPost.numberOfReports;
    const webhook = await context?.settings.get('webhook') as string;
    const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;

    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser.username);


    const settings = await context.settings.getAll();

    const legitUserSetting = settings[SettingName.LegitUsers] as string ?? "";
    const legitUsers = legitUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (legitUsers.includes(currentUser.username.toLowerCase()) || checkMod) {
    console.log(`${currentUser.username} is a legit user or a mod, okay.`);
    context.ui.showForm(contentDashboardP, { currentUser: currentUser, author: author, link: postLink, postScore: score, reportsNum: numOfReports}); 
  
    const webhook = await context?.settings.get('webhook') as string;
    const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;
  
    
    
     if (!webhook) {
      console.error('No webhook URL provided');
      return;
    }
    else {
    
        try {
          if (sendtoDiscord == false) {
            console.log("Not sending to Discord, skipping...");
          } else {
    
          let payload;
    
            let discordAlertMessage;
              discordAlertMessage = ``;
          
            if (webhook.startsWith('https://discord.com/api/webhooks/')) {
              console.log("Got Discord webhook, let's go!");
    
             // Check if the webhook is a Discord webhook
             payload = {
             content: discordAlertMessage,
             embeds: [
          {
            title: `${currentUser.username} has viewed the post details.`,
            url: `https://reddit.com${getPost.permalink}`,
            fields: [
              {
                name: 'Subreddit',
                value: `r/${subreddit.name}`,
                inline: true,
              },
              {
                name: 'User',
                value: `${currentUser.username}`,
                inline: true,
              },
              {
                name: 'Author',
                value: `${getPost.authorName}`,
                inline: true,
              },
              {
                name: 'Score',
                value: `${getPost.score}`,
                inline: true,
              },
              {
                name: 'Number of reports',
                value: `${getPost.numberOfReports}`,
                inline: true,
              },
            ],
          },
        ],
      }
    }
      try {
        // Send alert to Discord
        await fetch(webhook, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        console.log("Alert sent to Discord!");
      }
      catch (err) {
        console.error(`Error sending alert: ${err}`);
      }
    }
        }
        catch (err) {
          console.error(`Error sending alert: ${err}`);
        }
    }
  }
    else {
      console.log(`${currentUser.username} is not a legit user, nor a mod.`);
      if (!webhook) {
        console.error('No webhook URL provided');
        return;
      }
      else {
      
          try {
            if (sendtoDiscord == false) {
              console.log("Not sending to Discord, skipping...");
            } else {
      
            let payload;
      
              let discordAlertMessage;
                discordAlertMessage = ``;
            
              if (webhook.startsWith('https://discord.com/api/webhooks/')) {
                console.log("Got Discord webhook, let's go!");
      
               // Check if the webhook is a Discord webhook
               payload = {
               content: discordAlertMessage,
               embeds: [
            {
              title: `${currentUser.username} tried to view the post details.`,
              url: `https://reddit.com${getPost.permalink}`,
              fields: [
                {
                  name: 'Subreddit',
                  value: `r/${subreddit.name}`,
                  inline: true,
                },
                {
                  name: 'User',
                  value: `${currentUser.username}`,
                  inline: true,
                },
                {
                  name: 'Author',
                  value: `${getPost.authorName}`,
                  inline: true,
                },
                {
                  name: 'Score',
                  value: `${getPost.score}`,
                  inline: true,
                },
                {
                  name: 'Number of reports',
                  value: `${getPost.numberOfReports}`,
                  inline: true,
                },
              ],
            },
          ],
        }
      }
        try {
          // Send alert to Discord
          await fetch(webhook, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          console.log("Alert sent to Discord!");
        }
        catch (err) {
          console.error(`Error sending alert: ${err}`);
        }
      }
          }
          catch (err) {
            console.error(`Error sending alert: ${err}`);
          }
      }
      return ui.showToast("Sorry, you are not allowed to do that!");
    };
  },
});

const contentDashboardC = Devvit.createForm(
  (data) => ({
    fields: [
      {
        name: `origU`,
        label: 'Author',
        type: 'string',
        defaultValue: data.author,
        disabled: true
      },
      {
        name: `comLink`,
        label: 'Link',
        type: 'string',
        defaultValue: `https://reddit.com${data.link}`,
        disabled: true
      },
      {
      name: `score`,
      label: 'Score',
      type: 'number',
      defaultValue: data.postScore,
      disabled: true
    },
    {
      name: `numOfReports`,
      label: 'Number of reports',
      type: 'number',
      defaultValue: data.reportsNum,
      disabled: true
    },
    ],
    title: 'Content Dashboard',
  }),

  async (event, context) => {}
);

Devvit.addMenuItem({
  location: ['comment'],
  label: 'Comment Dashboard',
  description: 'More details about comment',
  onPress: async (event, context) => {
    const { ui } = context;
    const { location } = event;

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();

    const originalComment = context.commentId!;
    const getComment = await context.reddit.getCommentById(originalComment);
    const author = getComment.authorName;    
    const postLink = getComment.permalink;
    const score = getComment.score;
    const numOfReports = getComment.numReports;
    const webhook = await context?.settings.get('webhook') as string;
    const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;

    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser.username);


    const settings = await context.settings.getAll();

    const legitUserSetting = settings[SettingName.LegitUsers] as string ?? "";
    const legitUsers = legitUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (legitUsers.includes(currentUser.username.toLowerCase()) || checkMod) {
    console.log(`${currentUser.username} is a legit user or a mod, okay.`);
    context.ui.showForm(contentDashboardP, { currentUser: currentUser, author: author, link: postLink, postScore: score, reportsNum: numOfReports}); 
  
    const webhook = await context?.settings.get('webhook') as string;
    const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;
  
    
    
     if (!webhook) {
      console.error('No webhook URL provided');
      return;
    }
    else {
    
        try {
          if (sendtoDiscord == false) {
            console.log("Not sending to Discord, skipping...");
          } else {
    
          let payload;
    
            let discordAlertMessage;
              discordAlertMessage = ``;
          
            if (webhook.startsWith('https://discord.com/api/webhooks/')) {
              console.log("Got Discord webhook, let's go!");
    
             // Check if the webhook is a Discord webhook
             payload = {
             content: discordAlertMessage,
             embeds: [
          {
            title: `${currentUser.username} has viewed the comment details.`,
            url: `https://reddit.com${getComment.permalink}`,
            fields: [
              {
                name: 'Subreddit',
                value: `r/${subreddit.name}`,
                inline: true,
              },
              {
                name: 'User',
                value: `${currentUser.username}`,
                inline: true,
              },
              {
                name: 'Author',
                value: `${getComment.authorName}`,
                inline: true,
              },
              {
                name: 'Score',
                value: `${getComment.score}`,
                inline: true,
              },
              {
                name: 'Number of reports',
                value: `${getComment.numReports}`,
                inline: true,
              },
            ],
          },
        ],
      }
    }
      try {
        // Send alert to Discord
        await fetch(webhook, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        console.log("Alert sent to Discord!");
      }
      catch (err) {
        console.error(`Error sending alert: ${err}`);
      }
    }
        }
        catch (err) {
          console.error(`Error sending alert: ${err}`);
        }
    }
  }
    else {
      console.log(`${currentUser.username} is not a legit user, nor a mod.`);
      if (!webhook) {
        console.error('No webhook URL provided');
        return;
      }
      else {
      
          try {
            if (sendtoDiscord == false) {
              console.log("Not sending to Discord, skipping...");
            } else {
      
            let payload;
      
              let discordAlertMessage;
                discordAlertMessage = ``;
            
              if (webhook.startsWith('https://discord.com/api/webhooks/')) {
                console.log("Got Discord webhook, let's go!");
      
               // Check if the webhook is a Discord webhook
               payload = {
               content: discordAlertMessage,
               embeds: [
            {
              title: `${currentUser.username} tried to view the comment details.`,
              url: `https://reddit.com${getComment.permalink}`,
              fields: [
                {
                  name: 'Subreddit',
                  value: `r/${subreddit.name}`,
                  inline: true,
                },
                {
                  name: 'User',
                  value: `${currentUser.username}`,
                  inline: true,
                },
                {
                  name: 'Author',
                  value: `${getComment.authorName}`,
                  inline: true,
                },
                {
                  name: 'Score',
                  value: `${getComment.score}`,
                  inline: true,
                },
                {
                  name: 'Number of reports',
                  value: `${getComment.numReports}`,
                  inline: true,
                },
              ],
            },
          ],
        }
      }
        try {
          // Send alert to Discord
          await fetch(webhook, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          console.log("Alert sent to Discord!");
        }
        catch (err) {
          console.error(`Error sending alert: ${err}`);
        }
      }
          }
          catch (err) {
            console.error(`Error sending alert: ${err}`);
          }
      }
      return ui.showToast("Sorry, you are not allowed to do that!");
    };
  },
});


/* const remPointsR = Devvit.createForm(
  {
    title: 'Remove negative points',
    fields: [
      {
        name: `rP`,
        helpText: 'Select how many points you wish to remove for this content (1 or 3)',
        label: 'Number of points to remove',
        type: 'select',
        options: [
          {
            label: '1',
            value: 'removeOnePoint',
          },
          {
            label: '3',
            value: 'removeThreePoints',
          },
        ],
        multiSelect: false,
        required: true,
      },
    ],
    acceptLabel: 'Ok',
  }
  ); */

const addReason = Devvit.createForm(
    {
      title: 'In case your post may not be directly related to Croatia, please add a public reason for approving.',
      fields: [
        {
          name: 'theReason',
          label: 'The reason why the post should be visible on the subreddit',
          type: 'string',
        },
      ],
    },
    async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const originalPost = context.postId!;
    const approveReason = _event.values.theReason;
    const postAuthor = (await context.reddit.getPostById(originalPost)).authorName;
    const modName = await context.reddit.getCurrentUser();
    const appUser = await context.reddit.getCurrentUser();

    if (!approveReason){

      return ui.showToast("You must provide a reason. Please try again!");
  }
  else {

    var commentT = `Hello everyone!\n\n`;
    commentT += `This post may not be directly related to Croatia, but ${postAuthor} has wrote the following reason why this post should be visible:\n\n`;
    commentT += `> ${approveReason}\n\n`;
    commentT += `After that, post was approved by moderators!\n\n`;

   const apprComment = await context.reddit.submitComment({
      id: originalPost, 
      text: commentT,
   });

    apprComment.distinguish(true);
    apprComment.lock();

    ui.showToast(`Posted!`);

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: postAuthor,
      label: 'SPAM_WARNING',
      redditId: originalPost,
      note: `Reason provided.`
    })
    
  }}
);

Devvit.addMenuItem({
  location: 'post',
  label: 'Add reason (OP)',
  onPress: async (_event, context) => {
    const { ui } = context;

    const subreddit = await context.reddit.getCurrentSubreddit();
    const originalPost = context.postId!;
    const postAuthor = (await context.reddit.getPostById(originalPost)).authorName;
    const appUser = await context.reddit.getCurrentUser();

    if (postAuthor == appUser.username) {
    ui.showForm(addReason);
    } else {
      return ui.showToast("Sorry, you are not an OP!");
    }

  }
});


const repostF = Devvit.createForm(
    {
      title: 'Repost',
      fields: [
        {
          name: 'repostLink',
          label: 'Link to the original post',
          helpText: 'Optional',
          type: 'string',
        },
      ],
    },
    async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const originalPost = context.postId!;
    const postAuthor = (await context.reddit.getPostById(originalPost)).authorName;
    const modName = await context.reddit.getCurrentUser();

    if (!_event.values.repostLink){

      context.reddit.remove(originalPost, false);
      await (await context.reddit.getPostById(originalPost)).lock();

    const repostCom = await context.reddit.submitComment({
      id: originalPost, 
      text: `Hello, this is a repost.\n\nPlease check recent submissions. Thank you!\n\n`});

    repostCom.distinguish(true);
    repostCom.lock();
    submitPostReply
    ui.showToast(`Removed!`);

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: postAuthor,
      label: 'SPAM_WARNING',
      redditId: originalPost,
      note: `${modName.username} has removed repost (without URL to the original post).`
    })

    await context.modLog
        .add({
          action: 'removelink',
          target: originalPost,
          details: `Repost removed.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${originalPost}.`, e.message)
        );
  }
  else {
    context.reddit.remove(originalPost, false);
    await (await context.reddit.getPostById(originalPost)).lock();

    const repostCom = await context.reddit.submitComment({
      id: originalPost, 
      text: `Hello, this is a repost.\n\nPlease check [this](${_event.values.repostLink}) submission. Thank you!\n\n`});

    repostCom.distinguish(true);
    repostCom.lock();

    ui.showToast(`Removed and linked!`);

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: postAuthor,
      label: 'SPAM_WARNING',
      redditId: originalPost,
      note: `${modName.username} has removed repost (with URL to the original post).`
    })

    await context.modLog
        .add({
          action: 'removelink',
          target: originalPost,
          details: `Repost removed.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${originalPost}.`, e.message)
        );
    };

    
  }    
);

Devvit.addMenuItem({
  location: 'post',
  forUserType: 'moderator',
  label: 'Repost',
  onPress: async (_event, context) => {
    const { ui } = context;
    ui.showForm(repostF);

  }
});

Devvit.addMenuItem({
location: ['comment', 'post'],
forUserType: 'moderator',
label: 'Delete orteco content',
onPress: async (_event, context) => {
  const { reddit, ui } = context;

  if ((await context.reddit.getCommentById(context.commentId!)).authorName == 'orteco')
  {
    (await context.reddit.getCommentById(context.commentId!)).delete(); 
  }
  else {
    ui.showToast(`This is only for content removal by orteco!`);
  }
  return ui.showToast('Deleted!');
}
});






/* Devvit.addMenuItem({ // no need for this
  label: 'Remove All Strikes from Author',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: clearStrikes,
}); */

 function addHours(now: number, arg1: number): Date | undefined {
  throw new Error('Function not implemented.');
} 

/* function addMinutes(now: number, arg1: number): Date | undefined {
  throw new Error('Function not implemented.');
} */






export default Devvit;
function addMinutes(now: number, arg1: number): Date | undefined {
  throw new Error('Function not implemented.');
}

function addSeconds(now: number, arg1: number): Date | undefined {
  throw new Error('Function not implemented.');
}

function getCurrentYear(): number {
  const currentDate: Date = new Date();
  const currentYear: number = currentDate.getFullYear();
  return currentYear;
}

