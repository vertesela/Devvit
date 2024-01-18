import {
  Devvit,
  MenuItemOnPressEvent,
  ModMailTrigger,
  ModMailConversationState,
  RedditAPIClient,
  User,
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
  MenuItem
} from '@devvit/public-api';
// import { Paragraph, SUBREDDIT_LINK_ELEMENT } from '@devvit/public-api/helpers/richtext/types.js';


Devvit.configure({
  kvStore: true,
  redditAPI: true,
  redis: true
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
  console.log(`Dohvaćanje kaznenih bodova ${author.username}...`);
  return (await kvStore.get(key)) as number || 0;
}

 async function getMyStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { reddit, ui } = context;
  const author = await getAuthor(event, context);
  const currentUser = await reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const strikes = await getAuthorStrikes(currentUser, context);
  console.log(`${currentUser.username} provjerava svoj broj kaznenih bodova.`);


  if (strikes > 0) {
    ui.showToast(`Broj tvojih kaznenih bodova na r/${subreddit.name} je ${strikes}. Za više detalja nas kontaktiraj na Modmail.`);
     await context.reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: currentUser.id,
        subject: `Zahtjev za pristup podacima: r/${subreddit.name}`,
        text: `Bok ${currentUser.username}, broj tvojih kaznenih bodova je ${strikes}.\n\nUkoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.`,
      }
    )
  }
  else {
         await context.reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: currentUser.username,
        subject: `Zahtjev za pristup podacima: r/${subreddit.name}`,
        text: `Bok ${currentUser.username}, dobre vijesti - trenutno nemaš kaznenih bodova na r/${subreddit.name}.\n\nUkoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.`,
      }
    ) 
  }
 }

async function checkStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const author = await getAuthor(event, context);
  const { ui } = context;
  const strikes = await getAuthorStrikes(author, context);
  console.log(`Provjera kaznenih bodova kod ${author.username}...`);
  ui.showToast(`u/${author.username} has ${strikes} penalty point(s).`);
}

async function setAuthorStrikes(author: User, strikes: number, context: Devvit.Context) {
  const { kvStore } = context;
  const key = getKeyForAuthor(author);
  await kvStore.put(key, strikes);
}

async function removeStrike(event: MenuItemOnPressEvent, context: Devvit.Context) {
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

  const comRuleLink = await context.settings.get<string>(('pravila'));


  console.log(`${currentUser.username} uklanja kazneni bod korisniku ${author.username}...`);

  const userIsBanned = bannedCheck.length > 0;


    await thing!.approve();

  if (strikes > 0) {
    await setAuthorStrikes(author, --strikes, context);
    ui.showToast(`Penalty point removed for u/${author.username} (${strikes}).`);

    if (userIsBanned){ //unban, add mod mote and send msg
      await context.reddit.unbanUser(author.username, subreddit.name)
      await context.reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author.username,
          note: `${currentUser.username} removed the penalty point (${strikes}).`,
          label: 'SPAM_WARNING',
          redditId: event.targetId
        }
      );
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: author.username,
        subject: `Important notification: your activity on r/${subreddit.name}`,
        text: `Hello ${author.username},\n\nYou previously received a penalty point on r/${subreddit.name} for violation of Community Rules [here](https://reddit.com${permalink}).\nThe council has decided your fate and removed penalty point. We apologize for the mistake. **Current number of your penalty points: ${strikes}.**\n\nFor future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n~ r/${subreddit.name} Mod Team\n`,
        });
    }
    else { //if user is not banned, add mod note and send msg
      await context.reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author.username,
          note: `${currentUser.username} removed the penalty point (${strikes}).`,
          label: 'SPAM_WARNING',
          redditId: event.targetId
        }
      );
    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: author.username,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: `Hello ${author.username},\n\nYou previously received a penalty point on r/${subreddit.name} for violation of Community Rules [here](https://reddit.com${permalink}).\nThe council has decided your fate and removed penalty point. We apologize for the mistake. **Current number of your penalty points: ${strikes}.**\n\nFor future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n~ r/${subreddit.name} Mod Team\n`,
    });
    }
  }
}

async function remove3Strikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
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

  const comRuleLink = await context.settings.get<string>(('pravila'));


  console.log(`${currentUser.username} uklanja 3 kaznena boda korisniku ${author.username}...`);

  const userIsBanned = bannedCheck.length > 0;

    await thing!.approve();

  if (strikes > 0) {
    await setAuthorStrikes(author, strikes - 3, context);
    ui.showToast(`Three penalty points removed from u/${author.username} (${strikes - 3}).`);

    if (userIsBanned){
      await context.reddit.unbanUser(author.username, subreddit.name)
      await context.reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author.username,
          note: `${currentUser.username} removed 3 penalty points (${strikes - 3}).`,
          label: 'SPAM_WARNING',
          redditId: event.targetId
        }
      );
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: author.username,
        subject: `Important notification: your activity on r/${subreddit.name}`,
        text: `Hello ${author.username},\n\nYou previously received three penalty points on r/${subreddit.name} for violation of Community Rules [here](https://reddit.com${permalink}).\nThe council has decided your fate and removed the penalty points. We apologize for the mistake. **Current number of your penalty points: ${strikes - 3}.**\n\nFor future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n~ r/${subreddit.name} Mod Team\n`,
        });
      }
      else {
        await context.reddit.addModNote(
          {
            subreddit: subreddit.name,
            user: author.username,
            note: `${currentUser.username} removed 3 penalty points (${strikes - 3}).`,
            label: 'SPAM_WARNING',
            redditId: event.targetId
          }
        );
      await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: author.username,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: `Hello ${author.username},\n\nYou previously received three penalty points on r/${subreddit.name} for violation of Community Rules [here](https://reddit.com${permalink}).\nThe council has decided your fate and removed the penalty points. We apologize for the mistake. **Current number of your penalty points: ${strikes - 3}.**\n\nFor future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n~ r/${subreddit.name} Mod Team\n`,
    })
    };
  }
}


/* async function seriousToMinor(event: MenuItemOnPressEvent, context: Devvit.Context) {
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

    await thing!.approve();

  if (strikes > 0) {
    await setAuthorStrikes(author, strikes - 2, context);
    ui.showToast(`Uklonjena 2 kaznena boda kod u/${author.username} (${strikes - 2}).`);

    if (userIsBanned){
      await context.reddit.unbanUser(author.username, subreddit.name)
      await context.reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author.username,
          note: `${currentUser.username} uklanja 2 kaznena boda i skinut je ban (${strikes - 2}).`,
          label: 'SPAM_WARNING',
          redditId: event.targetId
        }
      );
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: author.username,
        subject: `Important notification: your activity on r/${subreddit.name}`,
        text: `Hello ${author.username},\n\nYou previously received three penalty points on r/${subreddit.name} for violation of Community Rules [here](https://reddit.com${permalink}).\nWe looked into the case and removed two penalty points. We apologize for the mistake. **Current number of your penalty points: ${strikes - 2}.**\n\nFor future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n~ r/${subreddit.name} Mod Team\n`,
        });
      }
      else {
        await context.reddit.addModNote(
          {
            subreddit: subreddit.name,
            user: author.username,
            note: `${currentUser.username} uklanja 2 kaznena boda (${strikes - 2}).`,
            label: 'SPAM_WARNING',
            redditId: event.targetId
          }
        );
      await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: author.username,
      subject: `Important notification: your activity on r/${subreddit.name}`,
      text: `Hello ${author.username},\n\nYou previously received three penalty points on r/${subreddit.name} for violation of Community Rules [here](https://reddit.com${permalink}).\nWe looked into the case and removed two penalty points. We apologize for the mistake. **Current number of your penalty points: ${strikes - 2}.**\n\nFor future reference, you can find helpful information by reviewing [Community Rules](${comRuleLink}) & [FAQ](https://www.reddit.com/r/croatia/wiki/guidelines_hrv/).\n\n~ r/${subreddit.name} Mod Team\n`,
    })
    };
  }
  ui.showToast(`u/${author.username} nema kaznenih bodova!`);
} */


/* async function clearStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Get some relevant data from the post or comment
  const author = await getAuthor(event, context);
  const hadStrikes = await getAuthorStrikes(author, context);
  const { ui } = context;

  if (hadStrikes > 0) {
    await setAuthorStrikes(author!, 0, context);
    ui.showToast(`Uklonjen broj strikeova za teške povrede kod u/${author.username}: ${hadStrikes}!`);
    return;
  }

  ui.showToast(`u/${author.username} nema strikeova za teške povrede!`);
} */

async function remHarassmentP(event: MenuItemOnPressEvent, context: Devvit.Context) {
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


  // Get the current subreddit from the metadata
  const { permalink } = thing;

  const genRule = await context.settings.get<string>(('generalRule'));

  var logHa = `Hello ${author.username},\n\n`;
  
  logHa += `You've received three penalty points for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logHa +=`**Link to removed content:**`;
  
  logHa += ` https://reddit.com${permalink}\n\n`;
  
  logHa += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
  
  logHa += `**Reason**: [Harassment](https://support.reddithelp.com/hc/en-us/articles/360043071072) | [Threatening violence](https://support.reddithelp.com/hc/en-us/articles/360043513151) | [Hate](https://support.reddithelp.com/hc/en-us/articles/360045715951)\n\n`;
    
  logHa += `**Understanding the Rules**\n\n\n`;
  
  logHa += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logHa += `**Reminder:**\n\n`;

  logHa += `> ${genRule}\n\n`;  
  
  logHa += `**Appeal Process**\n\n\n`;
  
  logHa += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logHa += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logHa += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logHa += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        reason: `Harassment`,
        note: `${currentUser.username} added 3 penalty points for harassment (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for harassment (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
    await reddit.setPostFlair({
    subredditName: subreddit.name,
    postId: thing!.id,
    flairTemplateId: await context.settings.get<string>('flairHarr')
  })
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
    console.log(`${currentUser.username} uklanja sadržaj korisnika ${author.username}.`);

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


  // Get the current subreddit from the metadata
  const { permalink } = thing;
  const genRule = await context.settings.get<string>(('generalRule'));

  var logHa = `Hello ${author.username},\n\n`;
  
  logHa += `You've received three penalty points for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logHa +=`**Link to removed content:**`;
  
  logHa += ` https://reddit.com${permalink}\n\n`;
  
  logHa += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
  
  logHa += `**Reason**: [Harassment](https://support.reddithelp.com/hc/en-us/articles/360043071072) | [Threatening violence](https://support.reddithelp.com/hc/en-us/articles/360043513151) | [Hate](https://support.reddithelp.com/hc/en-us/articles/360045715951)\n\n`;
    
  logHa += `**Understanding the Rules**\n\n\n`;
  
  logHa += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logHa += `**Reminder:**\n\n`;

  logHa += `> ${genRule}\n\n`;  
  
  logHa += `**Appeal Process**\n\n\n`;
  
  logHa += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logHa += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logHa += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logHa += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        reason: `Harassment`,
        note: `${currentUser.username} added 3 penalty points for harassment (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for harassment (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
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
  
  logEv += `Your [submission](https://reddit.com${permalink}) has been identified as an instance of **[ban evasion](https://support.reddithelp.com/hc/en-us/articles/360043504811-What-is-Ban-Evasion-)**, so you've received three penalty points for violating [site-wide rule 2](https://www.redditinc.com/policies/content-policy).\n\n\n`;
  
  logEv += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
      
  logEv += `**Understanding the Rules**\n\n\n`;
  
  logEv += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logEv += `**Reminder:**\n\n`;

  logEv += `> ${genRule}\n\n`;  
  
  logEv += `**Appeal Process**\n\n\n`;
  
  logEv += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logEv += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logEv += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logEv += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added 3 penalty points for Ban Evasion (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for Ban Evasion (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
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

  var logVM = `Hello ${author.username},\n\n`;
  
  logVM += `You've received three penalty points for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logVM +=`**Link to removed content:**`;
  
  logVM += ` https://reddit.com${permalink}\n\n`;
  
  logVM += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
  
  logVM += `**Reason**: [Vote manipulation](https://support.reddithelp.com/hc/en-us/articles/360043066412)\n\n`;
      
  logVM += `**Understanding the Rules**\n\n\n`;
  
  logVM += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logVM += `**Reminder:**\n\n`;

  logVM += `> ${genRule}\n\n`;  
  
  logVM += `**Appeal Process**\n\n\n`;
  
  logVM += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logVM += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logVM += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logVM += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added 3 penalty points for vote manipulation (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for vote manipulation (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
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

  var logS = `Hello ${author.username},\n\n`;
  
  logS += `You've received three penalty points for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logS +=`**Link to removed content:**`;
  
  logS += ` https://reddit.com${permalink}\n\n`;
  
  logS += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
  
  logS += `**Reason**: [Spam](https://support.reddithelp.com/hc/en-us/articles/360043504051)\n\n`;
      
  logS += `**Understanding the Rules**\n\n\n`;
  
  logS += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logS += `**Reminder:**\n\n`;

  logS += `> ${genRule}\n\n`;  
  
  logS += `**Appeal Process**\n\n\n`;
  
  logS += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logS += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logS += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logS += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added 3 penalty points for spamming (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for spamming (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
}

async function remDoxxingP(event: MenuItemOnPressEvent, context: Devvit.Context) {
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
  const genRule = await context.settings.get<string>(('generalRule'));

  var logDo = `Hello ${author.username},\n\n`;
  
  logDo += `You've received three penalty points for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logDo +=`**Link to removed content:**`;
  
  logDo += ` https://reddit.com${permalink}\n\n`;
  
  logDo += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
  
  logDo += `**Reason**: [Personal and confidental information](https://support.reddithelp.com/hc/en-us/articles/360043066452)\n\n`;
    
  logDo += `**Understanding the Rules**\n\n\n`;
  
  logDo += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logDo += `**Reminder:**\n\n`;

  logDo += `> ${genRule}\n\n`;  
  
  logDo += `**Appeal Process**\n\n\n`;
  
  logDo += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logDo += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logDo += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logDo += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added 3 penalty points for doxxing (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for doxxing (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
    await reddit.setPostFlair({
    subredditName: subreddit.name,
    postId: thing!.id,
    flairTemplateId: await context.settings.get<string>('flairPriv')
  })
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

  const genRule = await context.settings.get<string>(('generalRule'));

  var logDo = `Hello ${author.username},\n\n`;
  
  logDo += `You've received three penalty points for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logDo +=`**Link to removed content:**`;
  
  logDo += ` https://reddit.com${permalink}\n\n`;
  
  logDo += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
  
  logDo += `**Reason**: [Personal and confidental information](https://support.reddithelp.com/hc/en-us/articles/360043066452)\n\n`;
    
  logDo += `**Understanding the Rules**\n\n\n`;
  
  logDo += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logDo += `**Reminder:**\n\n`;

  logDo += `> ${genRule}\n\n`;  
  
  logDo += `**Appeal Process**\n\n\n`;
  
  logDo += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logDo += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logDo += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logDo += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added 3 penalty points for doxxing (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for doxxing (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
}

async function remIllegalP(event: MenuItemOnPressEvent, context: Devvit.Context) {
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


  var logIll = `Hello ${author.username},\n\n`;
  
  logIll += `You've received three penalty points for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logIll +=`**Link to removed content:**`;
  
  logIll += ` https://reddit.com${permalink}\n\n`;
  
  logIll += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
  
  logIll += `**Reason**: [Illegal or Probihited Transactions](https://support.reddithelp.com/hc/en-us/articles/360043513471)\n\n`;
    
  logIll += `**Understanding the Rules**\n\n\n`;
  
  logIll += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logIll += `**Reminder:**\n\n`;

  logIll += `> ${genRule}\n\n`;  
  
  logIll += `**Appeal Process**\n\n\n`;
  
  logIll += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logIll += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logIll += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logIll += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        context: thing!.id,
        reason: `Illegal content`,
        note: `${currentUser.username} added 3 penalty points for illegal content (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for illegal content(${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
    await reddit.setPostFlair({
    subredditName: subreddit.name,
    postId: thing!.id,
    flairTemplateId: await context.settings.get<string>('flairIllegal')
  })
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

  var logIll = `Hello ${author.username},\n\n`;
  
  logIll += `You've received three penalty points for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logIll +=`**Link to removed content:**`;
  
  logIll += ` https://reddit.com${permalink}\n\n`;
  
  logIll += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
  
  logIll += `**Reason**: [Illegal or Probihited Transactions](https://support.reddithelp.com/hc/en-us/articles/360043513471)\n\n`;
    
  logIll += `**Understanding the Rules**\n\n\n`;
  
  logIll += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logIll += `**Reminder:**\n\n`;

  logIll += `> ${genRule}\n\n`;  
  
  logIll += `**Appeal Process**\n\n\n`;
  
  logIll += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logIll += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logIll += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logIll += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        context: thing!.id,
        reason: `Illegal content`,
        note: `${currentUser.username} added 3 penalty points for illegal content (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for illegal content(${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
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

  var logBr = `Hello ${author.username},\n\n`;
  
  logBr += `You've received three penalty points for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logBr +=`**Link to removed content:**`;
  
  logBr += ` https://reddit.com${permalink}\n\n`;
  
  logBr += `**Penalty Point(s):** ${strikes + 3}\n\n\n`;
  
  logBr += `**Reason**: [Breaking the Site](https://support.reddithelp.com/hc/en-us/articles/360043512931)\n\n`;
    
  logBr += `**Understanding the Rules**\n\n\n`;
  
  logBr += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logBr += `**Reminder:**\n\n`;

  logBr += `> ${genRule}\n\n`;  
  
  logBr += `**Appeal Process**\n\n\n`;
  
  logBr += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logBr += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logBr += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logBr += `~ r/${subreddit.name} Mod Team\n\n`;


  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, strikes + 3, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added 3 penalty points for breaking the site (${strikes + 3}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added 3 penalty points for breaking the site (${strikes + 3}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
}

async function remEtiquetteP(event: MenuItemOnPressEvent, context: Devvit.Context) {
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
  
  logEtt += `You've received one penalty point for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logEtt +=`**Link to removed content:**`;
  
  logEtt += ` https://reddit.com${permalink}\n\n`;
  
  logEtt += `**Penalty Point(s):** ${strikes + 1}\n\n\n`;
  
  logEtt += `**Reason**:\n`;

  logEtt += `> ${ruleEtiq}\n\n`;

  logEtt += `> ${ruleEtiq2}\n\n`;

  logEtt += `**Understanding the Rules**\n\n\n`;
  
  logEtt += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logEtt += `**Reminder:**\n\n`;

  logEtt += `> ${genRule}\n\n`;  
  
  logEtt += `**Appeal Process**\n\n\n`;
  
  logEtt += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logEtt += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logEtt += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logEtt += `~ r/${subreddit.name} Mod Team\n\n`;



  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added a penalty point for insulting (${strikes}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a penalty point for insulting (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
    await reddit.setPostFlair({
    subredditName: subreddit.name,
    postId: thing!.id,
    flairTemplateId: await context.settings.get<string>('flairEtt')
  })
}

async function remEtiquette(event: MenuItemOnPressEvent, context: Devvit.Context) {
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
  
  logEtt += `You've received one penalty point for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logEtt +=`**Link to removed content:**`;
  
  logEtt += ` https://reddit.com${permalink}\n\n`;
  
  logEtt += `**Penalty Point(s):** ${strikes + 1}\n\n\n`;
  
  logEtt += `**Reason**:\n`;

  logEtt += `> ${ruleEtiq}\n\n`;

  logEtt += `> ${ruleEtiq2}\n\n`;

  logEtt += `**Understanding the Rules**\n\n\n`;
  
  logEtt += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logEtt += `**Reminder:**\n\n`;

  logEtt += `> ${genRule}\n\n`;  
  
  logEtt += `**Appeal Process**\n\n\n`;
  
  logEtt += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logEtt += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logEtt += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logEtt += `~ r/${subreddit.name} Mod Team\n\n`;


  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added a penalty point for insulting (${strikes}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a penalty point for insulting (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
}

async function remNonOP(event: MenuItemOnPressEvent, context: Devvit.Context) {
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

  var logNoN = `Hello ${author.username},\n\n`;
  
  logNoN += `You've received one penalty point for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logNoN +=`**Link to removed content:**`;
  
  logNoN += ` https://reddit.com${permalink}\n\n`;
  
  logNoN += `**Penalty Point(s):** ${strikes + 1}\n\n\n`;
  
  logNoN += `**Reason**:\n\n`;
    
  logNoN += `> ${ruleNoN}\n\n`;

  logNoN += `**Understanding the Rules**\n\n\n`;
  
  logNoN += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logNoN += `**Reminder:**\n\n`;

  logNoN += `> ${genRule}\n\n`;  
  
  logNoN += `**Appeal Process**\n\n\n`;
  
  logNoN += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logNoN += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logNoN += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logNoN += `~ r/${subreddit.name} Mod Team\n\n`;


  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added a penalty point for posting non-obscured private info (${strikes}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a penalty point for posting non-obscured private info (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
    await reddit.setPostFlair({
    subredditName: subreddit.name,
    postId: thing!.id,
    flairTemplateId: await context.settings.get<string>('flairNoN')
  })
}

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

  var logNoN = `Hello ${author.username},\n\n`;
  
  logNoN += `You've received one penalty point for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logNoN +=`**Link to removed content:**`;
  
  logNoN += ` https://reddit.com${permalink}\n\n`;
  
  logNoN += `**Penalty Point(s):** ${strikes + 1}\n\n\n`;
  
  logNoN += `**Reason**:\n\n`;
    
  logNoN += `> ${ruleNoN}\n\n`;

  logNoN += `**Understanding the Rules**\n\n\n`;
  
  logNoN += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logNoN += `**Reminder:**\n\n`;

  logNoN += `> ${genRule}\n\n`;  
  
  logNoN += `**Appeal Process**\n\n\n`;
  
  logNoN += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logNoN += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logNoN += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logNoN += `~ r/${subreddit.name} Mod Team\n\n`;


  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added a penalty point for posting non-obscured private info (${strikes}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a penalty point for posting non-obscured private info (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
}

async function remKmecanjeP(event: MenuItemOnPressEvent, context: Devvit.Context) {
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


  const RemRev = await context.settings.get<string>(('reasonKmecanje'));
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

  const ruleKme = await context.settings.get<string>(('textKmecanje'));
  const genRule = await context.settings.get<string>(('generalRule'));

  // let msgKme = '';
  var logKM = `Hello ${author.username},\n\n`;
  
  logKM += `You've received one penalty point for violating our [Community Rules]($${comRuleLink}).\n\n\n`;
  
  logKM +=`**Link to removed content:**`;
  
  logKM += ` https://reddit.com${permalink}\n\n`;
  
  logKM += `**Penalty Point(s):** ${strikes + 1}\n\n\n`;
  
  logKM += `**Reason**:\n`;
  
  logKM += `> ${ruleKme}\n\n`;
  
  logKM += `**Understanding the Rules**\n\n\n`;
  
  logKM += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logKM += `**Reminder:**\n\n`;

  logKM += `> ${genRule}\n\n`;  
  
  logKM += `**Appeal Process**\n\n\n`;
  
  logKM += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logKM += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logKM += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logKM += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added a penalty point for mod discussion (${strikes}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a penalty point for the mod discussion (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
    );
  }
  await reddit.setPostFlair({
    subredditName: subreddit.name,
    postId: thing!.id,
    flairTemplateId: await context.settings.get<string>('flairKmecanje')
  })
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


  // let msgKme = '';
  var logKM = `Hello ${author.username},\n\n`;
  
  logKM += `You've received one penalty point for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logKM +=`**Link to removed content:**`;
  
  logKM += ` https://reddit.com${permalink}\n\n`;
  
  logKM += `**Penalty Point(s):** ${strikes + 1}\n\n\n`;
  
  logKM += `**Reason**:\n`;
  
  logKM += `> ${ruleKme}\n\n`;
  
  logKM += `**Understanding the Rules**\n\n\n`;
  
  logKM += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;
  
  logKM += `**Reminder:**\n\n`;

  logKM += `> ${genRule}\n\n`; 
  
  logKM += `**Appeal Process**\n\n\n`;
  
  logKM += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logKM += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logKM += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logKM += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added a penalty point for mod discussion (${strikes}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a penalty point for the mod discussion (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
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


  var logOff = `Hello ${author.username},\n\n`;
  
  logOff += `You've received one penalty point for violating our [Community Rules](${comRuleLink}).\n\n\n`;
  
  logOff +=`**Link to removed content:**`;
  
  logOff += ` https://reddit.com${permalink}\n\n`;
  
  logOff += `**Penalty Point(s):** ${strikes + 1}\n\n\n`;
  
  logOff += `**Reason**:\n`;
  
  logOff += `> ${ruleOff}\n\n`;
  
  logOff += `**Understanding the Rules**\n\n\n`;
  
  logOff += `By registering on Reddit and joining on r/${subreddit.name}, you accepted these rules. We enforce these rules and ignorance is not an excuse. Joking does not exempt you from compliance. If unsure, review our [Community Rules](${comRuleLink}). Your responsibility ensures a respectful environment.\n\n`;

  logOff += `**Reminder:**\n\n`;

  logOff += `> ${genRule}\n\n`; 
  
  logOff += `**Appeal Process**\n\n\n`;
  
  logOff += `We understand that errors can occur, and if you believe a mistake has been made in issuing your penalty point, you have the right to appeal within 3 days.\n\n`;
  
  logOff += `Please bear in mind that our moderators are volunteers and may not be available around the clock. Your patience during the appeal process is appreciated, and we assure you that your case will be thoroughly considered.\n\n`;
  
  logOff += `**Note:** During the appeal process, we welcome open communication, but it must be conducted in a respectful and constructive manner. Any form of trolling or harassment in the appeal will lead to the rejection of the appeal, the assignment of additional penalty point(s), and reporting of the behavior to Reddit. We appreciate your cooperation in upholding these standards during the appeal.\n\n`;
  
  logOff += `~ r/${subreddit.name} Mod Team\n\n`;

  if (!userIsBanned && !thing.isRemoved())
  {
    await thing!.remove();
    await setAuthorStrikes(author, ++strikes, context);
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
  });};
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
  if (!RemRev) {
    console.error("Undefined removal reason");
    return;
  }
  { 
    await thing!.addRemovalNote({
    modNote: `Removed by ${currentUser.username}`,
    reasonId: RemRev
});};
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
        note: `${currentUser.username} added a penalty point due to offtopic/troll comment (${strikes}).`,
      }
    );
  }

  if (!userIsBanned) {
    const currentUser = await reddit.getCurrentUser();
    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: author.username,
        note: `${currentUser.username} added a penalty point due to offtopic/troll comment (${strikes}).`,
        label: 'SPAM_WARNING',
        redditId: event.targetId
      }
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
    const result = `Silently added penalty point (${strikes}).`;
  
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
        note: `${currentUser.username} has silently added a penalty point (${strikes}).`,
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
    ui.showToast(`Silently removed a penalty point from u/${author.username} (${strikes}).`);
  
    if (userIsBanned){ //unban, add mod mote and send msg
      //await context.reddit.unbanUser(author.username, subreddit.name)
      await context.reddit.addModNote(
        {
          subreddit: subreddit.name,
          user: author.username,
          note: `${currentUser.username} has silently removed a penalty point (${strikes}).`,
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
          note: `${currentUser.username} has silently removed a penalty point (${strikes}).`,
          label: 'SPAM_WARNING',
          redditId: event.targetId
        }
      );
    }
  }
}

/**
 * Declare our custom mod-only actions and add it to Posts and Comments
 */

Devvit.addSettings([{
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
/* },
{
  type: 'number',
  name: 'pointsOff',
  label: 'Koliko negativnih bodova za uklanjanje offtopic/troll komentara?', */
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
  name: 'pravila',
  label: 'Link to community rules',
}]);


Devvit.addMenuItem({
  label: '3. Non-obscured PI', //Remove content
  location: ['post'],
  forUserType: 'moderator',
  description: 'Content removal due to non-obscuring private info.',
  onPress: remNonOP,
});


Devvit.addMenuItem({
  label: '3. Non-obscured PI', //Remove content
  location: ['comment'],
  forUserType: 'moderator',
  description: 'Content removal due to non-obscuring private info.',
  onPress: remNonO,
});

Devvit.addMenuItem({
  label: '4. Harassment', //Remove content
  location: ['post'],
  forUserType: 'moderator',
  description: 'Content removal due to harassment.',
  onPress: remHarassmentP,
});


Devvit.addMenuItem({
  label: '4. Harassment', //Remove content
  location: ['comment'],
  forUserType: 'moderator',
  description: 'Content removal due to harassment.',
  onPress: remHarassment,
});

Devvit.addMenuItem({
  label: '5. Doxxing', //Remove content
  location: ['post'],
  forUserType: 'moderator',
  description: 'Content removal due to doxxing.',
  onPress: remDoxxingP,
});

Devvit.addMenuItem({
  label: '5. Doxxing', //Remove content
  location: ['comment'],
  forUserType: 'moderator',
  description: 'Content removal due to doxxing.',
  onPress: remDoxxing,
});

Devvit.addMenuItem({
  label: '6. Illegal content', //Remove content
  location: ['post'],
  forUserType: 'moderator',
  description: 'Removal of illegal content.',
  onPress: remIllegalP,
});

Devvit.addMenuItem({
  label: '6. Illegal content', //Remove content
  location: ['comment'],
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
  label: '7.2. Vote manipulation', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Content removal due to vote manipulation.',
  onPress: remVM,
});

Devvit.addMenuItem({
  label: '1. Insult',
  location: ['post'],
  forUserType: 'moderator',
  description: 'Content removal for insulting.',
  onPress: remEtiquetteP,
});

Devvit.addMenuItem({
  label: '1. Insult',
  location: ['comment'],
  forUserType: 'moderator',
  description: 'Content removal for insulting.',
  onPress: remEtiquette,
});

Devvit.addMenuItem({
  label: '2. Mod Topic',
  location: ['post'],
  forUserType: 'moderator',
  description: 'Mod topic removal.',
  onPress: remKmecanjeP,
});

Devvit.addMenuItem({
  label: '2. Mod Topic',
  location: ['comment'],
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
  description: 'Checking how many penalty points the User has.',
  onPress: checkStrikes,
});

Devvit.addMenuItem({
  label: 'PP: Remove', //Remove strike from that user
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Use only when reversing a minor violation. The User will be notified only for the lifted ban.',
  onPress: removeStrike,
  });

Devvit.addMenuItem({
  label: 'PP: Remove 3',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Use only when reversing a medium violation. The User will be notified.',
  onPress: remove3Strikes,
});

/* Devvit.addMenuItem({
  label: 'Change from Minor to Serious (punishment)',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Use only when changing a type of violation (from minor to serious). The User will be notified.',
  onPress: minorToSerious,
}); */

/* Devvit.addMenuItem({
  label: 'Change from Serious to Minor (punishment)',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  description: 'Use only when changing a type of violation (from serious to minor). The User will be notified.',
  onPress: seriousToMinor,
}); */


Devvit.addMenuItem({
  label: 'Provjera kaznenih bodova', //User option, how many strikes I have, sends a message
  location: ['subreddit'],
  forUserType: 'member',
  description: 'Mogućnost provjere kaznenih bodova iz moderatorske evidencije. ',
  onPress: async (_event, context) => {
    const { userId, reddit, ui } = context;
    const currentUser = await reddit.getCurrentUser();
    const subreddit = await reddit.getCurrentSubreddit();
    const strikes = await getAuthorStrikes(currentUser, context);
    console.log(`${currentUser.username} provjerava svoj broj kaznenih bodova.`);


  if (strikes > 0) {
     await context.reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: currentUser.username,
        subject: `Zahtjev za pristup podacima: r/${subreddit.name}`,
        text: `Bok ${currentUser.username}, broj tvojih kaznenih bodova je ${strikes}.\n\nUkoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.`,
      }
    )
    return ui.showToast(`Broj tvojih kaznenih bodova na r/${subreddit.name} je ${strikes}. Za više detalja nas kontaktiraj na Modmail.`);

  }
  else {
         await context.reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: currentUser.username,
        subject: `Zahtjev za pristup podacima: r/${subreddit.name}`,
        text: `Bok ${currentUser.username}, dobre vijesti - trenutno nemaš kaznenih bodova na r/${subreddit.name}.\n\nUkoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.`,
      }
    ) 
    return ui.showToast(`Nemaš kaznenih bodova na r/${subreddit.name}.`);
  }
 }
  }
);

/* Devvit.addSettings([{
  type: 'boolean',
  name: 'api',
  label: 'as',


}]); */

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


// Set up a state variable to track whether the custom message has been sent

/* Devvit.addSettings([
  {
    type: 'paragraph',
    name: 'log-alert',
    label: 'Custom Message (IN)',
  },
]); */



/*Devvit.addMenuItem({ // no need for this
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
