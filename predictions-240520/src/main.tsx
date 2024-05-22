import { Devvit, SettingScope } from '@devvit/public-api';
import { Service } from './service/Service.js';
import PredictionsPost from './components/PredictionsPost.js';
import { createPostForm } from './forms/createPostForm.js';
import { createPostOptionsForm } from './forms/createPostOptionsForm.js';
import { startTournamentForm } from './forms/startTournamentForm.js';
import { endTournamentForm } from './forms/endTournamentForm.js';
import { renameTournamentForm } from './forms/renameTournamentForm.js';
import { changePredictionEndForm } from './forms/changePredictionEndForm.js';
import { removePostForm } from './forms/removePostForm.js';
import { dispenseTokensForm } from './forms/dispenseTokensForm.js';

import {isModerator, hasPerformedActions, replacePlaceholders, getRecommendedPlaceholdersFromModAction, assembleRemovalReason, submitPostReply, ignoreReportsByPostId, setLockByPostId, isBanned} from "devvit-helpers";


Devvit.configure({
  redditAPI: true,
  redis: true,
});

export enum SettingName{
  ApprovedUsers = "approvedUsers",
};

// Send message to moderator when post expires
Devvit.addSchedulerJob({
  name: 'PostExpiryNotification',
  onRun: async (event, context) => {
    const { username, postId, question } = event.data!;
    const post = await context.reddit.getPostById(postId);
    await context.reddit.sendPrivateMessage({
      to: username,
      subject: 'Prediction expired',
      text: `A prediction post you created ([${question}](${post.permalink})) has expired. Please indicate the correct outcome once it's available to resolve the prediction for all players. Thanks for organizing!`,
    });
  },
});

// Add a menu item to the subreddit menu
// for instantiating the new custom post
Devvit.addMenuItem({
  label: '[Predictions] Create post',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { ui } = context;
    const service = new Service(context);

    // Check if there are active tournaments
    const tournaments = await service.tournament.getAllActive();
    if (tournaments.length === 0) {
      ui.showToast({ text: 'No active tournament' });
      return;
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();
    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser?.username);
    const settings = await context.settings.getAll();
    const approvedUserSetting = settings[SettingName.ApprovedUsers] as string ?? "";
    const approvedUsers = approvedUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (approvedUsers.includes(currentUser?.username.toLowerCase()) || checkMod) {
      console.log(`${currentUser?.username} is an approved user or a mod, okay.`);
      return context.ui.showForm(createPostForm, {
        tournaments: tournaments.map((tournament) => ({
          label: tournament.name,
          value: tournament.id,
        })),
      });
  } else {
    console.log(`${currentUser?.username} is not an approved user, nor a mod.`);
    return ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

// Add a subreddit menu item for starting a new tournament
Devvit.addMenuItem({
  label: '[Predictions] Start tournament',
  location: 'subreddit',
  onPress: async (_event, context) => {

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();
    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser?.username);
    const settings = await context.settings.getAll();
    const approvedUserSetting = settings[SettingName.ApprovedUsers] as string ?? "";
    const approvedUsers = approvedUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (approvedUsers.includes(currentUser?.username.toLowerCase()) || checkMod) {
      console.log(`${currentUser?.username} is an approved user or a mod, okay.`);
      return context.ui.showForm(startTournamentForm);
  } else {
    console.log(`${currentUser?.username} is not an approved user, nor a mod.`);
    return context.ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

// Add a subreddit menu item for ending the current tournament
Devvit.addMenuItem({
  label: '[Predictions] End tournament',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { ui } = context;
    const service = new Service(context);

    // Check if there is an active tournament
    const tournaments = await service.tournament.getAllActive();
    if (tournaments.length === 0) {
      ui.showToast({ text: 'No active tournaments found' });
      return;
    }

    // TODO: Check if there are any active questions
    // TODO: Check if the tournament has unresolved predictions


    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();
    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser?.username);
    const settings = await context.settings.getAll();
    const approvedUserSetting = settings[SettingName.ApprovedUsers] as string ?? "";
    const approvedUsers = approvedUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (approvedUsers.includes(currentUser?.username.toLowerCase()) || checkMod) {
      console.log(`${currentUser?.username} is an approved user or a mod, okay.`);
      return ui.showForm(endTournamentForm, {
        tournaments: tournaments.map((tournament) => ({
          label: tournament.name,
          value: tournament.id,
        })),
      });
  } else {
    console.log(`${currentUser?.username} is not an approved user, nor a mod.`);
    return context.ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

// A custom post definition for Predictions
Devvit.addCustomPostType({
  name: 'Predictions',
  height: 'tall',
  render: PredictionsPost,
});

// Moderator action to rename the tournament
Devvit.addMenuItem({
  label: '[Predictions] Rename tournament',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { ui } = context;
    const service = new Service(context);

    // Check if there is an active tournament
    const tournaments = await service.tournament.getAll();
    if (!tournaments) {
      ui.showToast({ text: 'No tournaments found' });
      return;
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();
    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser?.username);
    const settings = await context.settings.getAll();
    const approvedUserSetting = settings[SettingName.ApprovedUsers] as string ?? "";
    const approvedUsers = approvedUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (approvedUsers.includes(currentUser?.username.toLowerCase()) || checkMod) {
      console.log(`${currentUser?.username} is an approved user or a mod, okay.`);
      return context.ui.showForm(renameTournamentForm, {
        tournaments: tournaments.map((tournament) => ({
          label: tournament.name,
          value: tournament.id,
        })),
      });
  } else {
    console.log(`${currentUser?.username} is not an approved user, nor a mod.`);
    return context.ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

Devvit.addSettings([
    {
      name: SettingName.ApprovedUsers,
      type: "string",
      label: "A list of approved users",
    },
  {
    type: 'select',
    name: 'theme',
    label: 'Theme',
    options: [
      { label: 'Reddit', value: 'reddit' },
      { label: 'Unicorn', value: 'unicorn' },
    ],
    defaultValue: ['unicorn'],
    scope: SettingScope.Installation,
  },
  {
    type: 'select',
    name: 'tokenSymbol',
    label: 'Token symbol',
    options: [
      { label: 'Bananas', value: 'bananas.png' },
      { label: 'Baseball', value: 'baseball.png' },
      { label: 'Basketball', value: 'basketball.png' },
      { label: 'Bills', value: 'bills.png' },
      { label: 'Foam Finger', value: 'foam-finger.png' },
      { label: 'Heart', value: 'heart.png' },
      { label: 'Horse', value: 'horse.png' },
      { label: 'Rose', value: 'rose.png' },
      { label: 'Soccer', value: 'soccer.png' },
      { label: 'Star', value: 'star.png' },
      { label: 'Unicorn', value: 'unicorn.png' },
    ],
    defaultValue: ['unicorn.png'],
    scope: SettingScope.Installation,
  },
]);

// Mod action to change the end time of a post
// TODO: uncomment postFilter when it's available
Devvit.addMenuItem({
  label: '[Predictions] Change end time',
  location: 'post',
  forUserType: 'moderator',
  //postFilter: 'currentApp',
  onPress: async (_event, context) => {
    if (context.postId === undefined) {
      context.ui.showToast({ text: 'No post found' });
      return;
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();
    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser?.username);
    const settings = await context.settings.getAll();
    const approvedUserSetting = settings[SettingName.ApprovedUsers] as string ?? "";
    const approvedUsers = approvedUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (approvedUsers.includes(currentUser?.username.toLowerCase()) || checkMod) {
      console.log(`${currentUser?.username} is an approved user or a mod, okay.`);
      return context.ui.showForm(changePredictionEndForm, {
        postId: context.postId,
      });
  } else {
    console.log(`${currentUser?.username} is not an approved user, nor a mod.`);
    return context.ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

// Mod action to end a post right now
// TODO: uncomment postFilter when it's available
Devvit.addMenuItem({
  label: '[Predictions] End now',
  location: 'post',
  //postFilter: 'currentApp',
  onPress: async (event, context) => {

    const service = new Service(context);

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();
    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser?.username);
    const settings = await context.settings.getAll();
    const approvedUserSetting = settings[SettingName.ApprovedUsers] as string ?? "";
    const approvedUsers = approvedUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (approvedUsers.includes(currentUser?.username.toLowerCase()) || checkMod) {
      console.log(`${currentUser?.username} is an approved user or a mod, okay.`);
      await service.post.end(event.targetId);
    context.ui.showToast({ text: 'Post ended' });
  } else {
    console.log(`${currentUser?.username} is not an approved user, nor a mod.`);
    return context.ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

// Mod action to remove and refund a post
// TODO: uncomment postFilter when it's available
Devvit.addMenuItem({
  label: '[Predictions] Remove post',
  location: 'post',
  //postFilter: 'currentApp',
  onPress: async (event, context) => {

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();
    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser?.username);
    const settings = await context.settings.getAll();
    const approvedUserSetting = settings[SettingName.ApprovedUsers] as string ?? "";
    const approvedUsers = approvedUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (approvedUsers.includes(currentUser?.username.toLowerCase()) || checkMod) {
      console.log(`${currentUser?.username} is an approved user or a mod, okay.`);
      context.ui.showForm(removePostForm, {
        postId: event.targetId,
      });
  } else {
    console.log(`${currentUser?.username} is not an approved user, nor a mod.`);
    return context.ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

// Scheduled action to refund and message players
Devvit.addSchedulerJob({
  name: 'RemovePostTask',
  onRun: async (event, context) => {
    const service = new Service(context);
    await service.post.remove({
      postId: event.data?.postId,
      message: event.data?.message,
    });
  },
});

// Mod action to dispense more tokens to all players (with optional message)
Devvit.addMenuItem({
  label: '[Predictions] Dispense tokens',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const service = new Service(context);
    const tournaments = await service.tournament.getAllActive();

    if (!tournaments || tournaments.length === 0) {
      context.ui.showToast({ text: 'No active tournaments found' });
      return;
    }

    const availableTournaments = tournaments.map((tournament) => ({
      label: tournament.name,
      value: tournament.id,
    }));

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();
    const checkMod = await isModerator(context.reddit, subreddit.name, currentUser?.username);
    const settings = await context.settings.getAll();
    const approvedUserSetting = settings[SettingName.ApprovedUsers] as string ?? "";
    const approvedUsers = approvedUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (approvedUsers.includes(currentUser?.username.toLowerCase()) || checkMod) {
      console.log(`${currentUser?.username} is an approved user or a mod, okay.`);
      return context.ui.showForm(dispenseTokensForm, {
        tournaments: availableTournaments,
      });
  } else {
    console.log(`${currentUser?.username} is not an approved user, nor a mod.`);
    return context.ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

// Scheduled action to dispense tokens to players
Devvit.addSchedulerJob({
  name: 'DispenseTokensTask',
  onRun: async (event, context) => {
    const service = new Service(context);
    await service.tournament.dispenseTokens(
      event.data?.tournamentId,
      event.data?.tokens,
      event.data?.message
    );
  },
});

// Scheduled action to resolve a prediction
Devvit.addSchedulerJob({
  name: 'ResolvePredictionTask',
  onRun: async (event, context) => {
    const service = new Service(context);
    await service.post.resolve(
      event.data?.postId,
      event.data?.optionId,
      event.data?.tournamentId
    );
  },
});

// TODO: App config for who can create/resolve posts (mod perms, approved submitters, certain users, etc)

// TODO: Custom celebration screen.

// TODO: App config for single post vs multi post tournaments

// TODO: Menu action for users to opt out of private messages

// TODO: Menu action for users to opt out of predictions (self ban)

// TODO: Ability to schedule a post to be created at a future time

// TODO: Support for multiple winners

// TODO: Append a "none of the above" option to resoluton incase the mod forgets to include it

// TODO: Make mod resolution screen more visually distinct.

export default Devvit;
