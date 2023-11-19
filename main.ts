import {
  Devvit,
  MenuItemOnPressEvent,
  ModMailTrigger,
  ModMailConversationState,
  RedditAPIClient,
  User,
  Subreddit,
  ModMailActionType,
  PrivateMessage,
} from '@devvit/public-api';


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


 async function getMyStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { reddit, ui } = context;
  const author = await getAuthor(event, context);
  const currentUser = await reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const strikes = await getAuthorStrikes(currentUser, context);
  ui.showToast(`Poruka poslana! Baci oko na dolazne poruke :)`);

  if (strikes > 0) {
    await reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: currentUser.username,
        subject: `Zahtjev za pristup podacima: r/${subreddit.name}`,
        text: `Bok ${currentUser.username}, broj tvojih strikeova za teške povrede je ${strikes}.\n\nUkoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.`,
      }
    )
    return;
  }
  else {
    await reddit.sendPrivateMessageAsSubreddit(
      {
        fromSubredditName: subreddit.name,
        to: currentUser.username,
        subject: `Zahtjev za pristup podacima: r/${subreddit.name}`,
        text: `Bok ${currentUser.username}, dobre vijesti - trenutno nemaš strikeova za teške povrede na r/${subreddit.name}.\n\nUkoliko imaš pitanja, slobodno odgovori na ovu poruku i javit ćemo se u najkraćem mogućem roku.`,
      }
    )
    return;
  }

 };

async function checkStrikes(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const author = await getAuthor(event, context);
  const { ui } = context;
  const strikes = await getAuthorStrikes(author, context);
  ui.showToast(`Broj strikeova za teške povrede kod u/${author.username}: ${strikes}.`);
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
  let strikes = await getAuthorStrikes(author, context);

    const DateAndTime = new Date();

    var logAlert = `Poštovani, nedavno su izvršene promjene u broju strikeova od strane moderatora.\n\n`;

    logAlert += `**Datum i vrijeme:** ${DateAndTime}\n\n`;

    logAlert += `**Moderator**: ${currentUser.username}\n\n`;

    logAlert += `**Korisnik**: ${author.username}\n\n`;

    logAlert += `**Radnja**: Uklanjanje strikea\n\n`;

    logAlert += `**Trenutni broj strikeova kod korisnika**: ${strikes - 1}\n\n`;

    logAlert += `*Ovo je automatska poruka.*`;

  if (strikes > 0) {
    await setAuthorStrikes(author, --strikes, context);
    ui.showToast(`Uklonjen strike kod u/${author.username}. Trenutni broj strikeova za teške povrede: ${strikes}.`);
    reddit.sendPrivateMessage(
      {
      to: 'hredditmod',
      subject: `Promjene u broju strikeova na r/${subreddit.name}`,
      text: logAlert,
    }
    );
    return;
  }

  ui.showToast(`u/${author.username} nema strikeova za teške povrede!`);

}

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

async function strike(event: MenuItemOnPressEvent, context: Devvit.Context) {
  // Use the correct term in our message based on what was acted upon
  const { location } = event;
  const { reddit, ui } = context;
  const thing = await getThing(event, context);
  const author = await getAuthor(event, context);
  
  const currentUser = await reddit.getCurrentUser();
  // await reddit.addModNote; // +

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
  const now = new Date().getTime();

  // const alert = `Sadržaj je uklonjen, no strike je već dodijeljen tom korisniku u zadnja 2 sata!`;

  // await context.redis.set(`participation-recentcheck-${author.username}`, now.toString(), {expiration: addHours(now, 1)}); //new
  // ui.showToast(alert);


  await setAuthorStrikes(author, ++strikes, context);




  // What we'll send the user in a private message
  let pmMessage = '';
  // Used to tell the moderator what punishment the user received
  // let addModNote = true; //+
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
      `**Obavijest o teškoj povredi pravila**\n\nPozdrav ${author.username}, zaprimili smo prijavu povrede pravila na r/${subreddit.name}.\n\nNakon zaprimanja prijave, ustanovili smo da tvoj sadržaj krši [site-wide pravilo 1](https://support.reddithelp.com/hc/en-us/articles/360043071072), isti smo uklonili i šaljemo ti **upozorenje**.\n\nLink na uklonjen sadržaj: https://reddit.com${permalink}\n\nPreporučamo da prilikom budućeg sudjelovanja detaljno proučiš pravila.\n\n**Podsjetnik na pravilo 4.2.2.**\n > Teška povreda pravila obuhvaća site-wide pravila 1 i 3. U slučaju **prve ovakve povrede** pravila, Korisniku se izdaje upozorenje (automatskom porukom o uklanjanju sadržaja). U slučaju druge teške povrede, Korisnik će biti baniran na 15 dana. Svaka **daljnja teška povreda** rezultira **banom na 30 dana**.\n\nAko smatraš da je ovo greška, možeš podnijeti reklamaciju u roku od 7 dana. Reklamacije zaprimljene van roka neće se razmatrati.\n*Reklamacije neprimjerenog sadržaja prosljeđujemo Reddit administraciji.*\n\nVijeće moderatora r/${subreddit.name}\n\n`;
      punishment = `poslano je upozorenje`;
      ban = false;
      // addModNote = true;
      break;

    case 2:
      days = 15;
      pmMessage = 
      `**Obavijest o teškoj povredi pravila**\n\nPozdrav ${author.username}, zaprimili smo prijavu povrede pravila r/${subreddit.name}.\n\nNakon zaprimanja prijave, ustanovili smo da tvoj sadržaj krši [site-wide pravilo 1](https://support.reddithelp.com/hc/en-us/articles/360043071072) i isti smo uklonili. Budući da već imaš upozorenje o teškoj povredi pravila, ovaj put se dodjeljuje **ban na 15 dana**.\n\nLink na uklonjen sadržaj: https://reddit.com${permalink}\n\nPreporučamo da prilikom budućeg sudjelovanja detaljno proučiš pravila.\n\n**Podsjetnik na pravilo 4.2.2.**\n > Teška povreda pravila obuhvaća site-wide pravila 1 i 3. U slučaju **prve ovakve povrede** pravila, Korisniku se izdaje upozorenje (automatskom porukom o uklanjanju sadržaja). U slučaju druge teške povrede, Korisnik će biti baniran na 15 dana. Svaka **daljnja teška povreda** rezultira **banom na 30 dana**.\n\nAko smatraš da je ovo greška, možeš podnijeti reklamaciju u roku od 7 dana. Reklamacije zaprimljene van roka neće se razmatrati.\n\nPrije reklamacije, važno je znati da ti nije dodjeljen ban radi jednog sadržaja, već jer imaš raniju tešku povredu za koju ti je izdano upozorenje u obliku automatske poruke.\n\n*Reklamacije neprimjerenog sadržaja prosljeđujemo Reddit administraciji.*\n\nVijeće moderatora r/${subreddit.name}\n\n`;
      punishment = `baniran/a je na 15 dana`;
      break;

      default:
      // third strike, temp ban, warn again
      days = 30;
      pmMessage = 
      `**Obavijest o teškoj povredi pravila**\n\nPozdrav ${author.username}, zaprimili smo prijavu povrede pravila r/${subreddit.name}.\n\nNakon zaprimanja prijave, ustanovili smo da tvoj sadržaj krši [site-wide pravilo 1](https://support.reddithelp.com/hc/en-us/articles/360043071072) i isti smo uklonili. Budući da već imaš upozorenje o teškoj povredi pravila, ovaj put se dodjeljuje **ban na 30 dana**.\n\nLink na uklonjen sadržaj: https://reddit.com${permalink}\n\nPreporučamo da prilikom budućeg sudjelovanja detaljno proučiš pravila.\n\n**Podsjetnik na pravilo 4.2.2.**\n > Teška povreda pravila obuhvaća site-wide pravila 1 i 3. U slučaju **prve ovakve povrede** pravila, Korisniku se izdaje upozorenje (automatskom porukom o uklanjanju sadržaja). U slučaju druge teške povrede, Korisnik će biti baniran na 15 dana. Svaka **daljnja teška povreda** rezultira **banom na 30 dana**.\n\nAko smatraš da je ovo greška, možeš podnijeti reklamaciju u roku od 7 dana. Reklamacije zaprimljene van roka neće se razmatrati.\n\nPrije reklamacije, važno je znati da ti nije dodjeljen ban radi jednog sadržaja, već jer imaš raniju tešku povredu za koju ti je izdano upozorenje u obliku automatske poruke.\n\n*Reklamacije neprimjerenog sadržaja prosljeđujemo Reddit administraciji.*\n\nVijeće moderatora r/${subreddit.name}\n\n`;
      punishment = `baniran/a je na 30 dana`;
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
  const result = `Broj strikeova kod u/${author.username}: ${strikes} i ${punishment}.`;

  if (ban) {
    const currentUser = await reddit.getCurrentUser();
    await reddit.banUser(
      {
        subredditName: subreddit.name,
        username: author.username,
        duration: days,
        context: thing!.id,
        reason: `Broj strikeova za tešku povredu: ${strikes}.`,
        note: `Strike dodan od ${currentUser.username}`,
      }
    );
  }
  const DateAndTime = new Date();
  var logAlert = `Poštovani, nedavno su izvršene promjene u broju strikeova od strane moderatora.\n\n`;

  logAlert += `**Datum i vrijeme:** ${DateAndTime}\n\n`;

  logAlert += `**Moderator**: ${currentUser.username}\n\n`;

  logAlert += `**Korisnik**: ${author.username}\n\n`;

  logAlert += `**Radnja**: Dodavanje strikea\n\n`;

  logAlert += `**Trenutni broj strikeova kod korisnika**: ${strikes} i ${punishment}\n\n`;

  logAlert += `*Ovo je automatska poruka.*`;

  await reddit.sendPrivateMessage(
    {
      to: 'hredditmod',
      subject: `Promjene u broju strikeova na r/${subreddit.name}`,
      text: logAlert,  
    }
  );
}
 async function silentstrike(event: MenuItemOnPressEvent, context: Devvit.Context) {
    // Use the correct term in our message based on what was acted upon
    const { location } = event;
    const { reddit, ui } = context;
    const thing = await getThing(event, context);
    const author = await getAuthor(event, context);
    
    const currentUser = await reddit.getCurrentUser();
// Add a strike to the user and persist it to the KVStore
    let strikes = await getAuthorStrikes(author, context);
    await setAuthorStrikes(author, ++strikes, context);

    
    // Get the current subreddit from the metadata
    const subreddit = await reddit.getCurrentSubreddit();
    const result = `Dodan tihi strike. Broj strikeova kod u/${author.username}: ${strikes}.`;
  
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

    const DateAndTime = new Date();
    var logAlert = `Poštovani, nedavno su izvršene promjene u broju strikeova od strane moderatora.\n\n`;

    logAlert += `**Datum i vrijeme:** ${DateAndTime}\n\n`;

    logAlert += `**Moderator**: ${currentUser.username}\n\n`;

    logAlert += `**Korisnik**: ${author.username}\n\n`;

    logAlert += `**Radnja**: Dodavanje tihog strikea\n\n`;

    logAlert += `**Trenutni broj strikeova kod korisnika**: ${strikes}\n\n`;

    logAlert += `*Ovo je automatska poruka.*`;

  await reddit.sendPrivateMessage(
    {
      to: 'hredditmod',
      subject: `Promjene u broju strikeova na r/${subreddit.name}`,
      text: logAlert,
    }
   );
  }

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


/**
 * Declare our custom mod-only actions and add it to Posts and Comments
 */

Devvit.addMenuItem({
  label: 'Ukloni sadržaj', //Remove content
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: strike,
});

Devvit.addMenuItem({
  label: 'Dodaj tihi strike', //Silent strike (add strike, but without notification & ban), we use it for importing strikes for earlier violations
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: silentstrike,
})

Devvit.addMenuItem({
  label: `Provjeri broj strikeova`, // Check the number of author's strikes
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: checkStrikes,
});

Devvit.addMenuItem({
  label: 'Ukloni strike', //Remove strike from that user
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: removeStrike,
  });

Devvit.addMenuItem({
  label: 'Koliko imam strikeova?', //User option, how many strikes I have, sends a message
  location: ['post', 'comment', 'subreddit'],
  forUserType: 'member',
  onPress: getMyStrikes,
});

Devvit.addTrigger({
  event: 'ModMail',
  async onEvent(event, context) {

    console.log(`Received modmail trigger event:\n${JSON.stringify(event)}`);

    var conversationResponse = await context.reddit.modMail.getConversation({
      conversationId: event.conversationId
    });

    if (conversationResponse.conversation == undefined)
      return;

    if (!conversationResponse.conversation.numMessages || conversationResponse.conversation.numMessages > 1)
      return;

    if (!conversationResponse.conversation.participant || !conversationResponse.conversation.participant.name)
      return;
    
    // Check to see if conversation is already archived e.g. from a ban message
    var conversationIsArchived = (conversationResponse.conversation.state == ModMailConversationState.Archived);


    // If conversation was previously archived (e.g. a ban) archive it again.
    if (!conversationIsArchived)
    {
      await context.reddit.modMail.archiveConversation(event.conversationId);
    }
  }
});

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
