import { ModMail, PostFlairUpdate, StickyRequest } from '@devvit/protos';
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

import {isModerator, hasPerformedActions, replacePlaceholders, getRecommendedPlaceholdersFromModAction, assembleRemovalReason, submitPostReply, ignoreReportsByPostId, setLockByPostId, isBanned} from "devvit-helpers";



Devvit.configure({
  kvStore: false,
  redditAPI: true,
  redis: true,
  modLog: false,
  realtime: true,
  http: true,
});

/**
 * Creates a KVStore key for the author
 */
function getKeyForAuthor(author: User) {
  return `${author!.id}_strikes`; //dodan string
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

async function getAuthor(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { reddit } = context;
  const thing = await getThing(event, context);
  return await reddit.getUserById(thing.authorId!);
}

 async function getAuthorStrikes(author: User, context: Devvit.Context) {
  const { kvStore } = context;
  const key = getKeyForAuthor(author);
  console.log(`Dohvaćanje kaznenih bodova ${author!.username}...`);
  return (await kvStore.get(key)) as number || 0;
}

 async function setAuthorStrikes(author: User, strikes: number, context: Devvit.Context) {
  const { kvStore } = context;
  const key = getKeyForAuthor(author);
  await kvStore.put(key, strikes);
}


 async function checkStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const author = await getAuthor(event, context);
  const { ui } = context;
  const strikes = await getAuthorStrikes(author!, context);
  console.log(`Provjera kaznenih bodova kod ${author!.username}...`);
  ui.showToast(`u/${author?.username} has ${strikes} negative point(s).`);
} 

async function removeStrike(event: MenuItemOnPressEvent, context: Devvit.Context): Promise<void> {
  // Get some relevant data from the post or comment
  const { reddit, ui } = context;
  const { location } = event;
  const author = await getAuthor(event, context);
  const currentUser = await reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const thing = await getThing(event, context);
  const { permalink } = thing;
  let strikes = await getAuthorStrikes(author!, context);
  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author!.username,
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
    await setAuthorStrikes(author!, --strikes, context);
    ui.showToast(`Negative point removed for u/${author!.username} (${strikes}).`);
  
  
      var PenRemove = `Hello ${author!.username},\n\n`;
  
      PenRemove += `We've recently flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
    
      PenRemove += `> ${contentB}\n\n`;
    
      PenRemove += `> https://reddit.com${permalink}\n\n\n`;
  
      PenRemove += `After reviewing, we found that the content wasn't in violation of community rules. As a result, your negative point has been lifted. We apologize for the mistake.\n\n`;
  
      PenRemove += `**Current number of your negative points: ${strikes}.**\n\n`;
  
      PenRemove += `For future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n`;
  
      PenRemove += `~ r/${subreddit.name} Mod Team\n\n`;
  
  
      var negRemove = `Hello ${author!.username},\n\n`;
  
      negRemove += `We've recently flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
    
      negRemove += `> ${contentB}\n\n`;
    
      negRemove += `> https://reddit.com${permalink}\n\n\n`;
  
      negRemove += `After reviewing, we found that the content wasn't in violation of community rules. As a result, your negative point and ban have been lifted. We apologize for the mistake.\n\n`;
  
      negRemove += `**Current number of your negative points: ${strikes}.**\n\n`;
  
      negRemove += `For future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n`;
  
      negRemove += `~ r/${subreddit.name} Mod Team\n\n`;
  
  
      if (userIsBanned){ //unban, add mod mote and send msg
        await context.reddit.unbanUser(author!.username, subreddit.name)
        await context.reddit.addModNote(
          {
            subreddit: subreddit.name,
            user: author!.username,
            note: `${currentUser!.username} removed the negative point (${strikes}).`,
            label: 'SPAM_WARNING',
            redditId: event.targetId
          }
        );
        var messageToUser = await context.reddit.modMail.createConversation({
          subredditName: subreddit.name,
          to: author!.username,
          subject: `Important notification: your activity on r/${subreddit.name}`,
          body: negRemove,
          });
            await reddit.modMail.archiveConversation(messageToUser.conversation.id!);
      }
      else { //if user is not banned, add mod note and send msg
        await context.reddit.addModNote(
          {
            subreddit: subreddit.name,
            user: author!.username,
            note: `${currentUser!.username} removed the negative point (${strikes}).`,
            label: 'SPAM_WARNING',
            redditId: event.targetId
          }
        );
     var messageToUser2 =  await context.reddit.modMail.createConversation({
        subredditName: subreddit.name,
        to: author!.username,
        subject: `Important notification: your activity on r/${subreddit.name}`,
        body: PenRemove,
      });
      await reddit.modMail.archiveConversation(messageToUser2.conversation.id!);

      }
    } 
      else {
        return ui.showToast("Oops, error!");
      };
  

  console.log(`${currentUser!.username} uklanja kazneni bod korisniku ${author!.username}.`);
  
}


async function clearStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { reddit, ui } = context;
  const author = await getAuthor(event, context);
  const currentUser = await reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const thing = await getThing(event, context);
  let strikes = await getAuthorStrikes(author!, context);

  if (strikes > 0) {
    await setAuthorStrikes(author!, 0, context);
    ui.showToast(`Uklonjen broj negativnih bodova kod u/${author!.username}: ${strikes}!`);
    return;
  }

  await context.reddit.addModNote(
    {
      subreddit: subreddit.name,
      user: author!.username,
      note: `${currentUser!.username} removed ${strikes} negative point(s).`,
      label: 'SPAM_WARNING',
      redditId: event.targetId
    }
  );

  ui.showToast(`u/${author!.username} nema negativnih bodova!`);
}


async function remHarassment(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { location } = event;
  const { reddit, ui } = context;

  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  const currentUser = await reddit.getCurrentUser();

  const RemRev = await context.settings.get<string>('reasonHarassment');
  const comRuleLink = await context.settings.get<string>('pravila');
  const genRule = await context.settings.get<string>('generalRule');
  const flairHarr = await context.settings.get<string>('flairHarr');

  let strikes = await getAuthorStrikes(author!, context);

  const bannedCheck = await reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author!.username,
  }).all();

  const userIsBanned = bannedCheck.length > 0;

  const accountAgeDays = Math.floor(
    (Date.now() - author!.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const commentKarma = author!.commentKarma;
  const tooNewOrLowKarma = accountAgeDays < 30 || commentKarma < 100;

  let punishment = '';
  let ban = true;
  let days = 0;
  let shouldNotify = true;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;
  const { permalink } = thing;

  const createdAtGMTPlusOne = thing.createdAt.toLocaleString('en-US', {
    timeZone: 'Europe/Paris',
    hour12: false,
  });

  let logHa = `Hello ${author!.username},\n\n`;
  logHa += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`;
  logHa += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  logHa += `> ${contentB}\n\n`;
  logHa += `Link to removed content: https://reddit.com${permalink}\n\n\n`;
  logHa += `**Reason**: [Harassment](https://support.reddithelp.com/hc/en-us/articles/360043071072) | [Threatening violence](https://support.reddithelp.com/hc/en-us/articles/360043513151) | [Hate](https://support.reddithelp.com/hc/en-us/articles/360045715951)\n\n`;
  logHa += `As a result, we are issuing you three negative points, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 1}.**\n\n\n`;
  logHa += `**Reminder:**\n\n`;
  logHa += `> ${genRule}\n\n`;
  logHa += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  logHa += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved()) {
    await thing.remove();
    await thing.lock();

    await setAuthorStrikes(author!, ++strikes, context);

    switch (strikes) {
      case 1:
        logHa;
        if (!tooNewOrLowKarma) {
          ban = false; 
          shouldNotify = true;
          punishment = `warned`;
          break;
        } else {
          days = 15;
          shouldNotify = false;
          punishment = `banned for 15 days`;
          break;
        };

      case 2:
        logHa;
        if (!tooNewOrLowKarma) {
        days = 7;
        punishment = `banned for 7 days`;
        shouldNotify = true;
        break;
        } else {
          days = 30;
          punishment = `banned for 30 days`;
          shouldNotify = false;
          break;
        }
        
      case 3:
        logHa;        
        if (!tooNewOrLowKarma) {
        days = 15;
        punishment = `banned for 15 days`;
        shouldNotify = false;
        break;
        } else {
          days = 35;
          punishment = `permanently banned`;
          shouldNotify = false;
          break;
        }

      case 4:
        logHa;
        if (!tooNewOrLowKarma) {
        days = 30;
        punishment = `banned for 30 days`;
        shouldNotify = false;
        break;
        } else {
          punishment = `permanently banned`;
          shouldNotify = false;
          break;
        }

      default:
        logHa;
        punishment = `permanently banned`;
        shouldNotify = false;
        break;
    }

    ui.showToast(`${author!.username} is ${punishment} (${strikes}).`);
  } else {
    await thing.remove();
    await thing.lock();

    const alert = `Content has been removed, but points are not added because ${author!.username} is already banned or already sanctioned for this.`;
    return ui.showToast(alert);
  }

  const messageToUser = await reddit.modMail.createConversation(
    {
      subredditName: subreddit.name,
      to: author!.username,
      isAuthorHidden: true,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      body: logHa,
    }
  );

  if (!shouldNotify) {
    await reddit.modMail.archiveConversation(messageToUser.conversation.id!);
  } else {
    await reddit.modMail.reply({
      conversationId: messageToUser.conversation.id!,
      body: `Heads up - u/${author?.username} has ${strikes} negative points. According to our rules, this requires review. Please check previous removals.`,
      isInternal: true,
    });
  }

  if (ban) {
    await reddit.banUser({
      subredditName: subreddit.name,
      username: author!.username,
      duration: days,
      context: thing!.id,
      reason: `Harassment`,
      message: logHa,
      note: `Ban due to ${strikes} negative points.`,
    });
  }

  if (!userIsBanned) {
    await reddit.addModNote({
      subreddit: subreddit.name,
      user: author!.username,
      note: `${currentUser!.username} added a negative point for harassment (${strikes}).`,
      label: 'SPAM_WARNING',
      redditId: event.targetId,
    });
  }

  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairHarr,
    });
  }

  console.log(`${currentUser!.username} uklanja sadržaj korisnika ${author!.username}.`);
}

async function remDoxxing(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { location } = event;
  const { reddit, ui } = context;

  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  const currentUser = await reddit.getCurrentUser();

  const RemRev = await context.settings.get<string>('reasonDoxxing');
  const comRuleLink = await context.settings.get<string>('pravila');
  const genRule = await context.settings.get<string>('generalRule');
  const flairPriv = await context.settings.get<string>('flairPriv');

  let strikes = await getAuthorStrikes(author!, context);

  const bannedCheck = await reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author!.username,
  }).all();

  const userIsBanned = bannedCheck.length > 0;

  const accountAgeDays = Math.floor(
    (Date.now() - author!.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const commentKarma = author!.commentKarma;
  const tooNewOrLowKarma = accountAgeDays < 30 || commentKarma < 100;

  let punishment = '';
  let ban = true;
  let days = 0;
  let shouldNotify = true;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;
  const { permalink } = thing;

  const createdAtGMTPlusOne = thing.createdAt.toLocaleString('en-US', {
    timeZone: 'Europe/Paris',
    hour12: false,
  });

  let logDo = `Hello ${author!.username},\n\n`;
  logDo += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`;
  logDo += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  logDo += `> ${contentB}\n\n`;
  logDo += `Link to removed content: https://reddit.com${permalink}\n\n\n`;
  logDo += `**Reason**: [Personal and confidential information](https://support.reddithelp.com/hc/en-us/articles/360043066452)\n\n`;
  logDo += `As a result, we are issuing you one negative point, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 1}.**\n\n\n`;
  logDo += `**Reminder:**\n\n`;
  logDo += `> ${genRule}\n\n`;
  logDo += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  logDo += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved()) {
    await thing.remove();
    await thing.lock();

    await setAuthorStrikes(author!, ++strikes, context);

    switch (strikes) {

      case 1:
        logDo;
        if (!tooNewOrLowKarma) {
          ban = false;
          shouldNotify = true;
          punishment = `warned`;
          break;
        } else {
          days = 15;
          shouldNotify = false;
          punishment = `banned for 15 days`;
          break;
        }

      case 2:
        logDo;
        if (!tooNewOrLowKarma) {
          days = 7;
          punishment = `banned for 7 days`;
          shouldNotify = true;
          break;
        } else {
          days = 30;
          punishment = `banned for 30 days`;
          shouldNotify = false;
          break;
        }

      case 3:
        logDo;
        if (!tooNewOrLowKarma) {
          days = 15;
          punishment = `banned for 15 days`;
          shouldNotify = false;
          break;
        } else {
          days = 35;
          punishment = `permanently banned`;
          shouldNotify = false;
          break;
        }

      case 4:
        logDo;
        if (!tooNewOrLowKarma) {
          days = 30;
          punishment = `banned for 30 days`;
          shouldNotify = false;
          break;
        } else {
          punishment = `permanently banned`;
          shouldNotify = false;
          break;
        }

      default:
        logDo;
        punishment = `permanently banned`;
        shouldNotify = false;
        break;
    }

    ui.showToast(`${author!.username} is ${punishment} (${strikes}).`);

  } else {
    await thing.remove();
    await thing.lock();

    const alert = `Content has been removed, but points are not added because ${author!.username} is already banned or already sanctioned for this.`;
    return ui.showToast(alert);
  }

  const messageToUser = await reddit.modMail.createConversation(
    {
      subredditName: subreddit.name,
      to: author!.username,
      isAuthorHidden: true,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      body: logDo,
    }
  );

  if (!shouldNotify) {
    await reddit.modMail.archiveConversation(messageToUser.conversation.id!);
  } else {
    await reddit.modMail.reply({
      conversationId: messageToUser.conversation.id!,
      body: `Heads up - u/${author?.username} has ${strikes} negative points. According to our rules, this requires review. Please check previous removals.`,
      isInternal: true,
    });
  }

  if (ban) {
    await reddit.banUser({
      subredditName: subreddit.name,
      username: author!.username,
      duration: days,
      context: thing!.id,
      reason: `Doxxing`,
      message: logDo,
      note: `Ban due to ${strikes} negative points.`,
    });
  }

  if (!userIsBanned) {
    await reddit.addModNote({
      subreddit: subreddit.name,
      user: author!.username,
      note: `${currentUser!.username} added a negative point for doxxing (${strikes}).`,
      label: 'SPAM_WARNING',
      redditId: event.targetId,
    });
  }

  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairPriv,
    });
  }

  console.log(`${currentUser!.username} uklanja sadržaj korisnika ${author!.username}.`);
}


async function remSpam(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { location } = event;
  const { reddit, ui } = context;

  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  const currentUser = await reddit.getCurrentUser();

  const RemRev = await context.settings.get<string>('reasonSpam');
  const comRuleLink = await context.settings.get<string>('pravila');
  const genRule = await context.settings.get<string>('generalRule');

  let strikes = await getAuthorStrikes(author!, context);

  const bannedCheck = await reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author!.username,
  }).all();

  const userIsBanned = bannedCheck.length > 0;

  const createdAtGMTPlusOne = thing.createdAt.toLocaleString('en-US', {
    timeZone: 'Europe/Paris',
    hour12: false,
  });

  const accountAgeDays = Math.floor(
    (Date.now() - author!.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const commentKarma = author!.commentKarma;
  const tooNewOrLowKarma = accountAgeDays < 30 || commentKarma < 100;

  let punishment = '';
  let ban = true;
  let days = 0;
  let shouldNotify = true;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;
  const { permalink } = thing;

  let logS = `Hello ${author!.username},\n\n`;
  logS += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`;
  logS += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  logS += `> ${contentB}\n\n`;
  logS += `Link to removed content: https://reddit.com${permalink}\n\n\n`;
  logS += `**Reason**: [Spam](https://support.reddithelp.com/hc/en-us/articles/360043504051)\n\n`;
  logS += `As a result, we are issuing you one negative point, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 1}.**\n\n\n`;
  logS += `**Reminder:**\n\n`;
  logS += `> ${genRule}\n\n`;
  logS += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  logS += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved()) {
    await thing.remove();
    await thing.lock();

    await setAuthorStrikes(author!, ++strikes, context);

    switch (strikes) {

      case 1:
        logS;
        if (!tooNewOrLowKarma) {
          ban = false;
          shouldNotify = true;
          punishment = `warned`;
          break;
        } else {
          days = 15;
          shouldNotify = false;
          punishment = `banned for 15 days`;
          break;
        }

      case 2:
        logS;
        if (!tooNewOrLowKarma) {
          days = 7;
          punishment = `banned for 7 days`;
          shouldNotify = true;
          break;
        } else {
          days = 30;
          punishment = `banned for 30 days`;
          shouldNotify = false;
          break;
        }

      case 3:
        logS;
        if (!tooNewOrLowKarma) {
          days = 15;
          punishment = `banned for 15 days`;
          shouldNotify = false;
          break;
        } else {
          days = 35;
          punishment = `permanently banned`;
          shouldNotify = false;
          break;
        }

      case 4:
        logS;
        if (!tooNewOrLowKarma) {
          days = 30;
          punishment = `banned for 30 days`;
          shouldNotify = false;
          break;
        } else {
          punishment = `permanently banned`;
          shouldNotify = false;
          break;
        }

      default:
        logS;
        punishment = `permanently banned`;
        shouldNotify = false;
        break;
    }

    ui.showToast(`${author!.username} is ${punishment} (${strikes}).`);
  }

  else {
    await thing.remove();
    await thing.lock();

    const alert = `Content has been removed, but points are not added because ${author!.username} is already banned or already sanctioned for this.`;
    return ui.showToast(alert);
  }

  const messageToUser = await reddit.modMail.createConversation(
    {
      subredditName: subreddit.name,
      to: author!.username,
      isAuthorHidden: true,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      body: logS,
    }
  );

  if (!shouldNotify) {
    await reddit.modMail.archiveConversation(messageToUser.conversation.id!);
  } else {
    await reddit.modMail.reply({
      conversationId: messageToUser.conversation.id!,
      body: `Heads up - u/${author?.username} now has ${strikes} negative points. According to our rules, this requires review. Please check earlier sanctions.`,
      isInternal: true,
    });
  }

  if (ban) {
    await reddit.banUser({
      subredditName: subreddit.name,
      username: author!.username,
      duration: days,
      context: thing!.id,
      reason: `Spam`,
      message: logS,
      note: `Ban due to ${strikes} negative points.`,
    });
  }

  if (!userIsBanned) {
    await reddit.addModNote({
      subreddit: subreddit.name,
      user: author!.username,
      note: `${currentUser!.username} added a negative point for spam (${strikes}).`,
      label: 'SPAM_WARNING',
      redditId: event.targetId,
    });
  }

  console.log(`${currentUser!.username} uklanja sadržaj korisnika ${author!.username}.`);
}

async function remIllegal(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { location } = event;
  const { reddit, ui } = context;

  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  const currentUser = await reddit.getCurrentUser();

  const RemRev = await context.settings.get<string>('reasonIllegal');
  const comRuleLink = await context.settings.get<string>('pravila');
  const genRule = await context.settings.get<string>('generalRule');
  const flairIllegal = await context.settings.get<string>('flairIllegal');

  let strikes = await getAuthorStrikes(author!, context);

  const bannedCheck = await reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author!.username,
  }).all();

  const userIsBanned = bannedCheck.length > 0;

  const createdAtGMTPlusOne = thing.createdAt.toLocaleString('en-US', {
    timeZone: 'Europe/Paris',
    hour12: false,
  });

  const accountAgeDays = Math.floor(
    (Date.now() - author!.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const commentKarma = author!.commentKarma;
  const tooNewOrLowKarma = accountAgeDays < 30 || commentKarma < 100;

  let punishment = '';
  let ban = true;
  let days = 0;
  let shouldNotify = true;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;
  const { permalink } = thing;

  let logIll = `Hello ${author!.username},\n\n`;
  logIll += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`;
  logIll += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  logIll += `> ${contentB}\n\n`;
  logIll += `Link to removed content: https://reddit.com${permalink}\n\n\n`;
  logIll += `**Reason**: [Illegal or Prohibited Transactions](https://support.reddithelp.com/hc/en-us/articles/360043513471)\n\n`;
  logIll += `As a result, we are issuing you one negative point, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 1}.**\n\n\n`;
  logIll += `**Reminder:**\n\n`;
  logIll += `> ${genRule}\n\n`;
  logIll += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  logIll += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved()) {
    await thing.remove();
    await thing.lock();

    await setAuthorStrikes(author!, ++strikes, context);

    switch (strikes) {

      case 1:
        logIll;
        if (!tooNewOrLowKarma) {
          ban = false;
          shouldNotify = true;
          punishment = `warned`;
          break;
        } else {
          days = 15;
          shouldNotify = false;
          punishment = `banned for 15 days`;
          break;
        }

      case 2:
        logIll;
        if (!tooNewOrLowKarma) {
          days = 7;
          punishment = `banned for 7 days`;
          shouldNotify = true;
          break;
        } else {
          days = 30;
          punishment = `banned for 30 days`;
          shouldNotify = false;
          break;
        }

      case 3:
        logIll;
        if (!tooNewOrLowKarma) {
          days = 15;
          punishment = `banned for 15 days`;
          shouldNotify = false;
          break;
        } else {
          days = 35;
          punishment = `permanently banned`;
          shouldNotify = false;
          break;
        }

      case 4:
        logIll;
        if (!tooNewOrLowKarma) {
          days = 30;
          punishment = `banned for 30 days`;
          shouldNotify = false;
          break;
        } else {
          punishment = `permanently banned`;
          shouldNotify = false;
          break;
        }

      default:
        logIll;
        punishment = `permanently banned`;
        shouldNotify = false;
        break;
    }

    ui.showToast(`${author!.username} is ${punishment} (${strikes}).`);
  }

  else {
    await thing.remove();
    await thing.lock();

    const alert = `Content has been removed, but points are not added because ${author!.username} is already banned or already sanctioned for this.`;
    return ui.showToast(alert);
  }

  const messageToUser = await reddit.modMail.createConversation(
    {
      subredditName: subreddit.name,
      to: author!.username,
      isAuthorHidden: true,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      body: logIll,
    }
  );

  if (!shouldNotify) {
    await reddit.modMail.archiveConversation(messageToUser.conversation.id!);
  } else {
    await reddit.modMail.reply({
      conversationId: messageToUser.conversation.id!,
      body: `Heads up - u/${author?.username} now has ${strikes} negative points. According to our rules, this requires review. Please check earlier sanctions.`,
      isInternal: true,
    });
  }

  if (ban) {
    await reddit.banUser({
      subredditName: subreddit.name,
      username: author!.username,
      duration: days,
      context: thing!.id,
      reason: `Illegal content`,
      message: logIll,
      note: `Ban due to ${strikes} negative points.`,
    });
  }

  if (!userIsBanned) {
    await reddit.addModNote({
      subreddit: subreddit.name,
      user: author!.username,
      note: `${currentUser!.username} added a negative point for illegal content (${strikes}).`,
      label: 'SPAM_WARNING',
      redditId: event.targetId,
    });
  }

  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairIllegal,
    });
  }

  console.log(`${currentUser!.username} uklanja sadržaj korisnika ${author!.username}.`);
}


async function remEtiquette(event: MenuItemOnPressEvent, context: Devvit.Context) {

  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  const currentUser = await reddit.getCurrentUser();


  const comRuleLink = await context.settings.get<string>(('pravila'));


  // Add a strike to the user and persist it to the KVStore
  let strikes = await getAuthorStrikes(author!, context);
  const now = new Date().getTime();


  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author!.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;


  let createdAt: Date = thing.createdAt;

  // Convert the date to GMT+1 timezone
  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris', // GMT+1 timezone
    hour12: false // Use 24-hour format
  };

  let createdAtGMTPlusOne: string = createdAt.toLocaleString('en-US', options);

  console.log(createdAtGMTPlusOne);

   const accountAgeDays = Math.floor(
      (Date.now() - author!.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

const commentKarma = author!.commentKarma;

    // 3) var/const for your condition
    const tooNewOrLowKarma = accountAgeDays < 30 || commentKarma < 500;


  // Used to tell the moderator what punishment the user received
  let punishment = '';
  // Ban if they're on their 2nd or 3rd strike
  let ban = true;
  // We'll determine how long the ban lasts based on how many strikes they have
  let days = 0;

  let shouldNotify = true;


  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const ruleEtiq = await context.settings.get<string>(('textetiq'));
  const genRule = await context.settings.get<string>(('generalRule'));

  var logEtt = `Hello ${author!.username},\n\n`;
  
  logEtt += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`
  
  logEtt += `However, we've flagged the following content which you posted on r/${subreddit.name} on ${createdAtGMTPlusOne} as a rule violation:\n\n\n`;
  
  logEtt += `> ${contentB}\n\n`;
  
  logEtt += `Link to removed content: https://reddit.com${permalink}\n\n\n`;

  logEtt += `**Reason**:\n\n`;
  
  logEtt += `> ${ruleEtiq}\n\n`;
  
  logEtt += `As a result, we are issuing you one negative point, removing the content, and reminding you to follow the rules. **Current number of your negative points: ${strikes + 1}.**\n\n\n`;
  
  logEtt += `**Reminder:**\n\n`;

  logEtt += `> ${genRule}\n\n`; 

  logEtt += `We understand that errors can occur, and if you believe a mistake has been made in issuing your negative point, you have the right to appeal within 3 days. Please refrain from deleting the removed content, as it will hinder our ability to consider your appeal. Negative points expire after 12 months.\n\n`;
  
  logEtt += `~ r/${subreddit.name} Mod Team\n\n`;



  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await thing!.lock();

    await setAuthorStrikes(author!, ++strikes, context);
 
    switch (strikes) {
      
      case 1:
        logEtt;
        punishment = `warned`;
        ban = false;
        shouldNotify = false;
        break;    
  
     case 2:
        logEtt;
        punishment = `warned`;
        ban = false;
        shouldNotify = false;
        break;
        
      case 3:
        logEtt;
        if (!tooNewOrLowKarma) {
          ban = false; 
          shouldNotify = true;
          punishment = `warned`;
        } else {
          days = 3;
          shouldNotify = false;
          punishment = `banned for 3 days`;
        }
        break;
        
      case 4:
        logEtt;
        if (!tooNewOrLowKarma) {
          ban = false; 
          shouldNotify = true;
          punishment = `warned`;
        } else {
          days = 3;
          shouldNotify = false;
          punishment = `banned for 3 days`;
        }
        break;

        default:
        logEtt;
        days = 5;
        shouldNotify = false;
        punishment = `banned for 5 days`;
        break;
      }

      const result = `${author!.username} is ${punishment} (${strikes}).`;
      ui.showToast(result);
    }

else {
  await thing!.remove();
  await thing!.lock();

  const alert = `Content has been removed, but points are not added because ${author!.username} is already banned or already sanctioned for this.`;
  console.log(`${currentUser!.username} uklanja sadržaj, korisnik ${author!.username} je već baniran.`);
  return ui.showToast(alert);
};


  const messageToUser = await reddit.modMail.createConversation(
    {
      subredditName: subreddit.name,
      to: author!.username,
      isAuthorHidden: true,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      body: logEtt,
    },
    );


    if (!shouldNotify) {
    console.log("No need for notifying...");
    await context.reddit.modMail.archiveConversation(messageToUser.conversation.id!);
  } else {
    await reddit.modMail.reply({
      conversationId: messageToUser.conversation.id!,
      body: `Heads up - u/${author?.username} has ${strikes} negative points. According to our rules, ${author?.username} should be banned. Please check the previous removals.`,
      isInternal: true
    })
    
  };
    
  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author!.username,
        duration: days,
        context: thing!.id,
        reason: `Insulting`,
        message: logEtt,
        note: `Ban due to ${strikes} negative points.`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author!.username,
        note: `${currentUser!.username} added a negative point for insulting (${strikes}).`,
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
  console.log(`${currentUser!.username} uklanja sadržaj korisnika ${author!.username}.`);
};

async function remKmecanje(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { location } = event;
  const { reddit, ui } = context;

  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  const subreddit = await reddit.getCurrentSubreddit();
  const currentUser = await reddit.getCurrentUser();

  const comRuleLink = await context.settings.get<string>('pravila');
  const ruleKme = await context.settings.get<string>('textKmecanje');
  const genRule = await context.settings.get<string>('generalRule');
  const flairKmecanje = await context.settings.get<string>('flairKmecanje');

  const contentB = `${thing!.body?.split("\n\n").join("\n\n> ")}`;

  // STRIKES
  let strikes = await getAuthorStrikes(author!, context);

  // IS USER BANNED ALREADY?
  const bannedCheck = await context.reddit
    .getBannedUsers({
      subredditName: subreddit.name,
      username: author!.username,
    })
    .all();

  const userIsBanned = bannedCheck.length > 0;

  const accountAgeDays = Math.floor(
    (Date.now() - author!.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const commentKarma = author!.commentKarma;
  const tooNewOrLowKarma = accountAgeDays < 30 || commentKarma < 500;

  // Ban logic variables
  let punishment = '';
  let ban = true;
  let days = 0;
  let shouldNotify = true;

  const { permalink } = thing;

  let options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Paris',
    hour12: false,
  };

  let createdAtGMTPlusOne = thing.createdAt.toLocaleString('en-US', options);

  // MESSAGE BODY
  let logKM = `Hello ${author!.username},\n\n`;

  logKM += `r/${subreddit.name} is a place for open discussion and engagement where all users are welcome to participate, but they must follow our [Community Rules](${comRuleLink}) which they accepted by registering on Reddit and joining r/${subreddit.name}.\n\n`;

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

  // -------------------------
  // MAIN LOGIC (same as remEtiquette)
  // -------------------------

  if (!userIsBanned && !thing.isRemoved()) {

    await thing.remove();
    await thing.lock();

    await setAuthorStrikes(author!, ++strikes, context);

    // BAN / WARNING LOGIC (synced with remEtiquette)
    switch (strikes) {
      case 1:
        logKM;
        punishment = `warned`;
        ban = false;
        shouldNotify = false;
        break;

      case 2:
        logKM;
        punishment = `warned`;
        ban = false;
        shouldNotify = false;
        break;

      case 3:
        logKM;
        if (!tooNewOrLowKarma) {
          punishment = `warned`;
          ban = false;
          shouldNotify = true;
        } else {
          days = 3;
          punishment = `banned for 3 days`;
          shouldNotify = false;
        }
        break;

      case 4:
        logKM;
        if (!tooNewOrLowKarma) {
          punishment = `warned`;
          ban = false;
          shouldNotify = true;
        } else {
          days = 3;
          punishment = `banned for 3 days`;
          shouldNotify = false;
        }
        break;

      default:
        logKM;
        days = 5;
        punishment = `banned for 5 days`;
        shouldNotify = false;
        break;
    }

    ui.showToast(`${author!.username} is ${punishment} (${strikes}).`);
  }

  else {
    // Already banned logic (same style as remEtiquette)
    await thing.remove();
    await thing.lock();

    const alert = `Content has been removed, but points are not added because ${author!.username} is already banned or already sanctioned for this.`;
    console.log(`${currentUser!.username} removed content; ${author!.username} is already banned.`);
    return ui.showToast(alert);
  }

  // MODMAIL (identical system to remEtiquette)
  const messageToUser = await reddit.modMail.createConversation(
    {
      subredditName: subreddit.name,
      to: author!.username,
      isAuthorHidden: true,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      body: logKM,
    }
  );

  if (!shouldNotify) {
    console.log("No need for notifying...");
    await context.reddit.modMail.archiveConversation(messageToUser.conversation.id!);
  } else {
    await reddit.modMail.reply({
      conversationId: messageToUser.conversation.id!,
      body: `Heads up - u/${author?.username} has ${strikes} negative points. According to our rules, ${author?.username} should be banned. Please check the previous removals.`,
      isInternal: true,
    });
  }

  // BAN
  if (ban) {
    await reddit.banUser({
      subredditName: subreddit.name,
      username: author!.username,
      duration: days,
      context: thing!.id,
      reason: `Kmečanje`,
      message: logKM,
      note: `Ban due to ${strikes} negative points.`,
    });
  }

  // MOD NOTE
  if (!userIsBanned) {
    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: author!.username,
      note: `${currentUser!.username} added a negative point for the mod discussion (${strikes}).`,
      label: 'SPAM_WARNING',
      redditId: event.targetId,
    });
  }

  // FLAIR
  if (location === 'post') {
    reddit.setPostFlair({
      subredditName: subreddit.name,
      postId: thing!.id,
      flairTemplateId: flairKmecanje,
    });
  }

  console.log(`${currentUser!.username} removed content from ${author!.username}.`);
};

async function silentPointAdd(event: MenuItemOnPressEvent, context: Devvit.Context) {
    // Use the correct term in our message based on what was acted upon
    const { location } = event;
    const { reddit, ui } = context;
    const thing = await getThing(event, context);
    const author = await getAuthor(event, context);
    const subreddit = await reddit.getCurrentSubreddit();
    const currentUser = await reddit.getCurrentUser();
// Add a strike to the user and persist it to the KVStore
    let strikes = await getAuthorStrikes(author!, context);
    await setAuthorStrikes(author!, ++strikes, context);

    
    // Get the current subreddit from the metadata
    const result = `Silently added negative point (${strikes}).`;
  
    ui.showToast(result);

    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author!.username,
        note: `${currentUser!.username} has silently added a negative point (${strikes}).`,
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
  let strikes = await getAuthorStrikes(author!, context);
  const bannedCheck = await context.reddit.getBannedUsers({
    subredditName: subreddit.name,
    username: author!.username,
  }).all();
  const userIsBanned = bannedCheck.length > 0;
    
  if (strikes > 0) {
    await setAuthorStrikes(author!, --strikes, context);
    ui.showToast(`Silently removed a negative point from u/${author!.username} (${strikes}).`);
  
        await context.reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author!.username,
          note: `${currentUser!.username} has silently removed a negative point (${strikes}).`,
          label: 'SPAM_WARNING',
          redditId: event.targetId
        }
      );
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

      if (!(event.moderator?.name == ("AutoModerator")) && event.action == ("approvelink") && (event.targetPost && event.targetPost.numComments < 2) && event.targetPost.numReports > 1) {
        console.log('Found approvelink action by mod...');

        const postLink = event.targetPost?.permalink;
        const postAuthor = event.targetUser!.name;

        var textMsg = `Hi u/${postAuthor},\n\n`;
        textMsg += `We would like to inform you that your [post](${postLink}) has now been approved by moderators.\n\n`,
        textMsg += `For future reference, you can find helpful information by reviewing subreddit rules & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n`;
        textMsg += `~ r/${subreddit.name} Mod Team\n\n`;


        await context.reddit.modMail.createConversation({
          subredditName: subreddit.name,
          to: postAuthor,
          isAuthorHidden: true,
          subject: `Your post on r/${subreddit.name} has been approved by moderators!`,
          body: textMsg
        })
        console.log(`Message sent to ${postAuthor}!`);

      }
      else {
        console.log(`Not approval action, ignoring..`);
      }
    }
  }
  );

Devvit.addSettings([
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
  name: 'flairRep',
  label: 'Flair ID for repost',
},
{
  type: 'string',
  name: 'textetiq',
  label: 'Rule for insulting',
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
  label: '[orteco] Insult',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal for insulting.',
  onPress: remEtiquette,
});

Devvit.addMenuItem({
  label: '[orteco] Mod Topic',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Mod topic removal.',
  onPress: remKmecanje,
});


Devvit.addMenuItem({
  label: '[orteco] Harassment', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to harassment.',
  onPress: remHarassment,
});

Devvit.addMenuItem({
  label: '[orteco] Doxxing', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to doxxing.',
  onPress: remDoxxing,
});

Devvit.addMenuItem({
  label: '[orteco] Illegal content', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Removal of illegal content.',
  onPress: remIllegal,
});

Devvit.addMenuItem({
  label: '[orteco] Spam', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to spamming.',
  onPress: remSpam,
});

Devvit.addMenuItem({
  label: `[orteco] NP: Check`, // Check the number of author's strikes
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Checking how many negative points the User has.',
  onPress: checkStrikes,
});

Devvit.addMenuItem({
  label: '[orteco] NP: Remove', //Remove strike from that user
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Use only when reversing a minor violation. The User will be notified.',
  onPress: removeStrike,
  });

  Devvit.addMenuItem({
    label: '[orteco] NP: Silent add', //Silent strike (add strike, but without notification & ban), we use it for importing strikes for earlier violations
    location: ['post', 'comment'],
    forUserType: 'moderator',
    description: 'Use only for the purpose of migration of previous violations. No notification, no ban.',
    onPress: silentPointAdd,
  });
  
  Devvit.addMenuItem({
    label: '[orteco] NP: Silent remove', //Silent strike (add strike, but without notification & ban), we use it for importing strikes for earlier violations
    location: ['post', 'comment'],
    forUserType: 'moderator',
    description: 'Remove point without notification.',
    onPress: silentPointRemove,
  });


/*  Devvit.addTrigger({
  event: 'ModMail',
  async onEvent(event, context) {
  
    const subreddit = event.conversationSubreddit;

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
 */

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
      user: postauthor!,
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
      user: postauthor!,
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
label: '[orteco] Delete content',
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


export default Devvit;
