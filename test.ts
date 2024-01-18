// This is just an invalid part of code (Redis)

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


Devvit.configure({
  kvStore: true,
  redditAPI: true,
  redis: true
});
Devvit.addMenuItem({
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
  const { redis } = context;
  const key = getKeyForAuthor(author);
  console.log(`Dohvaćanje kaznenih bodova ${author.username}...`);
  return (await redis.get(key)) as unknown as number || 0;
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
  const strikesBefore = await getAuthorStrikes(author, context);
  console.log(`Provjera kaznenih bodova kod ${author.username}...`);
  // Perform some action that changes the strikes (e.g., add points)
  // await addThreeStrikesWithExpiration(author, context);

  // Wait for a short period (adjust as needed)
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Now, check the updated number of strikes
  const strikesAfter = await getAuthorStrikes(author, context);
  console.log(`Updated number of strikes for ${author.username}: ${strikesAfter}`);
  ui.showToast(`u/${author.username} has ${strikesBefore} penalty point(s).`);

}


// ##########################################################
async function setAuthorStrikes(author: User, strikes: number, context: Devvit.Context, expirationTime: number) {
  const { redis } = context;
  const key = getKeyForAuthor(author);
  // await redis.set(key, strikes.toFixed()); ovo je radilo, samo treba 
  //await context.redis.set(`participation-recentcheck-${author.username}`, strikes.toString(), {expiration: addMinutes(now, 2)});
 // const currentStrikes = await redis.incrBy(key, strikes);

  const strikesKey = `${key}:strikes`;

  // Set the value for the new points (increment strikes by the specified points)
  const currentStrikes = await context.redis.incrBy(strikesKey, strikes);

  // Set expiration for the new points to the specified expiration time
  await context.redis.expire(strikesKey, expirationTime);

  console.log(`${author.username} has been assigned ${strikes} negative points. Total strikes: ${currentStrikes}`);

// Schedule a cleanup job for the points after the specified expiration time
const jobId = await context.scheduler.runJob({
  name: 'cleanupPoints',
  data: {
    strikesKey,
    strikes,
  },
  runAt: new Date(Date.now() + expirationTime * 1000), // Convert seconds to milliseconds
});

console.log(`Cleanup job scheduled with ID: ${jobId}`);
}

// Add a scheduler job to handle the cleanup
Devvit.addSchedulerJob({
  name: 'cleanupPoints',
  onRun: async (event, context) => {
    const { strikesKey, strikes } = event.data!;

    // Check the current value
    const currentStrikes = await context.redis.get(strikesKey);

    if (currentStrikes !== undefined) {
      // Perform the decrement
      const parsedStrikes = parseInt(currentStrikes, 10);
      const newStrikes = Math.max(0, isNaN(parsedStrikes) ? 0 : parsedStrikes - strikes);

      // Set the new value
      await context.redis.set(strikesKey, newStrikes.toString());

      console.log(`Expired: 1 negative point. Remaining strikes: ${strikes - 1}. Var new strikes ${newStrikes}, parsed ${parsedStrikes} and current ${currentStrikes}`);
    } else {
      console.log(`Key does not exist. No cleanup needed.`);
    }
  },
});
// Example usage:
// await setAuthorStrikes(author, strikes + 3, context, 120);
