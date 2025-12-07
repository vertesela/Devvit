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
  TriggerEvent,
  SettingScope,
} from "@devvit/public-api";

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addSettings([
  {
    type: "boolean",
    name: "allPerms",
    label: "Require full mod permissions?",
    helpText:
      "If enabled, only moderators with full permissions can use this app.",
    defaultValue: false,
  },
  {
    type: "boolean",
    name: "autoArchive",
    label: "Auto-archive app messages?",
    helpText:
      "If enabled, the app will automatically archive all messages it creates.",
    defaultValue: true,
  },
  {
    type: "boolean",
    name: "sendModmail",
    label: "Send a Modmail copy?",
    helpText: `If enabled, app will send the copy to the modmail. Currently required for security and logging. This option cannot be disabled for now. Once Reddit's Wiki API is improved, a choice between Modmail and Wiki logging will be added.`,
    defaultValue: true,
    disabled: true,
  },
  /* {
  type: 'group',
  label: 'Event 1',
   fields: [
      {
        type: 'string',
        name: 'event1Label',
        label: 'Event 1 label',
        scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event1Subject',
    label: 'Event 1 subject',
    scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event1Body',
    label: 'Event 1 body',
    scope: SettingScope.Installation,
  },
]
},
{
  type: 'group',
  label: 'Event 2',
   fields: [
      {
        type: 'string',
        name: 'event2Label',
        label: 'Event 2 label',
        scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event2Subject',
    label: 'Event 2 subject',
    scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event2Body',
    label: 'Event 2 body',
    scope: SettingScope.Installation,
  },
]
},
{
  type: 'group',
  label: 'Event 3',
   fields: [
      {
        type: 'string',
        name: 'event3Label',
        label: 'Event 3 label',
        scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event3Subject',
    label: 'Event 3 subject',
    scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event3Body',
    label: 'Event 3 body',
    scope: SettingScope.Installation,
  },
]
},
{
  type: 'group',
  label: 'Event 4',
   fields: [
      {
        type: 'string',
        name: 'event4Label',
        label: 'Event 4 label',
        scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event4Subject',
    label: 'Event 4 subject',
    scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event4Body',
    label: 'Event 4 body',
    scope: SettingScope.Installation,
  },
]
},
{
  type: 'group',
  label: 'Event 5',
   fields: [
      {
        type: 'string',
        name: 'event5Label',
        label: 'Event 5 label',
        scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event5Subject',
    label: 'Event 5 subject',
    scope: SettingScope.Installation,
  },
  {
    type: 'string',
    name: 'event5Body',
    label: 'Event 5 body',
    scope: SettingScope.Installation,
  },
] */
]);

/* type EventKey = 'event1' | 'event2' | 'event3' | 'event4' | 'event5';

type UserSubscriptions = {
  event1?: boolean;
  event2?: boolean;
  event3?: boolean;
  event4?: boolean;
  event5?: boolean;
};

type ModManageUserSubsFormData = {
  username?: string; // optional for typing; we enforce at runtime
  event1Label?: string;
  event2Label?: string;
  event3Label?: string;
  event4Label?: string;
  event5Label?: string;
  event1?: boolean;
  event2?: boolean;
  event3?: boolean;
  event4?: boolean;
  event5?: boolean;
};

const userSubsKey = (username: string) => `subs:user:${username}`;
const eventSubsKey = (eventKey: EventKey) => `subs:event:${eventKey}`;

async function resolveUsernameCase(
  context: Devvit.Context,
  input: string
): Promise<string | undefined> {
  // strip optional "u/" prefix and trim
  const raw = input.trim().replace(/^u\//i, '');

  // Reddit lookup is case-insensitive
  const user = await context.reddit.getUserByUsername(raw);
  if (!user) {
    // user doesn't exist / suspended / etc.
    return undefined;
  }

  // This is the canonical username (correct casing)
  return user.username;
}

export async function getSubscribers(
  redis: Devvit.Context['redis'],
  eventKey: EventKey
): Promise<string[]> {
  const key = eventSubsKey(eventKey);

  // Read the hash: field = username, value = "1"
  const record = await redis.hgetall(key); // Record<string, string> or undefined [[hGetAll](https://developers.reddit.com/docs/api/public-api/type-aliases/RedisClient#hgetall-1)]
  if (!record) return [];

  // Field names are the usernames
  return Object.keys(record);
}

// Get all event subscriptions for a user from Redis
async function getUserSubscriptions(
  redis: Devvit.Context['redis'],
  username: string
): Promise<UserSubscriptions> {
  const key = userSubsKey(username);
  const record = await redis.hgetall(key); // hash read [[Redis hash](https://developers.reddit.com/docs/capabilities/server/redis#hash)]
  if (!record) return {};

  const result: UserSubscriptions = {};
  (['event1', 'event2', 'event3', 'event4', 'event5'] as EventKey[]).forEach(
    (eventKey) => {
      if (record[eventKey] !== undefined) {
        result[eventKey] = record[eventKey] === '1';
      }
    }
  );

  return result;
}

// Set a single event subscription for a user (updates user + event hashes)
async function setUserSubscription(
  redis: Devvit.Context['redis'],
  username: string,
  eventKey: EventKey,
  subscribed: boolean
): Promise<void> {
  const userKey = `subs:user:${username}`;
  const eventKeyRedis = `subs:event:${eventKey}`;

  if (subscribed) {
    await redis.hset(userKey, { [eventKey]: '1' });
    await redis.hset(eventKeyRedis, { [username]: '1' });
  } else {
    await redis.hdel(userKey, [eventKey]);
    await redis.hdel(eventKeyRedis, [username]);
  }
}

const modManageUserSubsForm = Devvit.createForm(
  (data: {
    username?: string;
    event1Label?: string;
    event2Label?: string;
    event3Label?: string;
    event4Label?: string;
    event5Label?: string;
    event1?: boolean;
    event2?: boolean;
    event3?: boolean;
    event4?: boolean;
    event5?: boolean;
  }) => ({
    title: data.username
      ? `Manage subscriptions for u/${data.username}`
      : 'Manage user subscriptions',
    fields: [
      // keep username in values so we can read it from event.values
      {
        type: 'string',
        name: 'username',
        label: 'Username',
        defaultValue: data.username,
        required: true,
        disabled: true,
      },
      {
        type: 'group',
        label: 'Events',
        fields: [
          {
            type: 'boolean',
            name: 'event1',
            label: data.event1Label ?? 'Event 1',
            defaultValue: data.event1,
          },
          {
            type: 'boolean',
            name: 'event2',
            label: data.event2Label ?? 'Event 2',
            defaultValue: data.event2,
          },
          {
            type: 'boolean',
            name: 'event3',
            label: data.event3Label ?? 'Event 3',
            defaultValue: data.event3,
          },
          {
            type: 'boolean',
            name: 'event4',
            label: data.event4Label ?? 'Event 4',
            defaultValue: data.event4,
          },
          {
            type: 'boolean',
            name: 'event5',
            label: data.event5Label ?? 'Event 5',
            defaultValue: data.event5,
          },
        ],
      },
    ],
    acceptLabel: 'Save',
    cancelLabel: 'Cancel',
  }) as const,
  async (event, context) => {
    const { username, event1, event2, event3, event4, event5 } = event.values as {
      username: string;
    } & UserSubscriptions;

    if (!username) {
      await context.ui.showToast({ text: 'Username missing.' });
      return;
    }

    // *** CASE‑NORMALIZATION CHECK ADDED HERE ***
    const raw = username.trim().replace(/^u\//i, '');
    const user = await context.reddit.getUserByUsername(raw); // case‑insensitive lookup [[getUserByUsername](https://developers.reddit.com/docs/api/redditapi/RedditAPIClient/classes/RedditAPIClient#getuserbyusername)]
    if (!user) {
      await context.ui.showToast({ text: `User u/${raw} not found.` });
      return;
    }
    const canonicalUsername = user.username; // correct casing from API [[User](https://developers.reddit.com/docs/api/redditapi/models/classes/User)]

    await setUserSubscription(context.redis, canonicalUsername, 'event1', !!event1);
    await setUserSubscription(context.redis, canonicalUsername, 'event2', !!event2);
    await setUserSubscription(context.redis, canonicalUsername, 'event3', !!event3);
    await setUserSubscription(context.redis, canonicalUsername, 'event4', !!event4);
    await setUserSubscription(context.redis, canonicalUsername, 'event5', !!event5);

    await context.ui.showToast({
      text: `Updated subscriptions for u/${canonicalUsername}`,
    });
  }
);

//
// Form 1: ask mod for username, then open form 2
//

const modUserLookupForm = Devvit.createForm(
  {
    title: 'Lookup user subscriptions',
    fields: [
      {
        type: 'string',
        name: 'username',
        label: 'Username (without u/)',
        required: true,
      },
    ],
    acceptLabel: 'Next',
    cancelLabel: 'Cancel',
  } as const,
  async (event, context) => {
    const { username } = event.values as { username: string };

    const settings = await context.settings.getAll(); // subreddit settings [[Settings access](https://developers.reddit.com/docs/capabilities/server/settings-and-secrets#accessing-settings-in-your-app)]
    const current = await getUserSubscriptions(context.redis, username);

    await context.ui.showForm(modManageUserSubsForm, {
      username,
      event1Label: settings.event1Label as string | undefined,
      event2Label: settings.event2Label as string | undefined,
      event3Label: settings.event3Label as string | undefined,
      event4Label: settings.event4Label as string | undefined,
      event5Label: settings.event5Label as string | undefined,
      ...current, // pre-fill booleans
    });
  }
);

//
// Menu item for mods to start the 2-step flow
//

Devvit.addMenuItem({
  label: 'Manage user event subs',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    await context.ui.showForm(modUserLookupForm);
  },
});

// ---- The "manage my subscriptions" form ----

const manageMySubsForm = Devvit.createForm(
  (data: {
    event1Label?: string;
    event2Label?: string;
    event3Label?: string;
    event4Label?: string;
    event5Label?: string;
    event1?: boolean;
    event2?: boolean;
    event3?: boolean;
    event4?: boolean;
    event5?: boolean;
  }) => ({
    title: 'Manage event subscriptions',
    description: 'Choose which events you want to receive messages about.',
    fields: [
      {
        type: 'group',
        label: 'Events',
        fields: [
          {
            type: 'boolean',
            name: 'event1',
            label: data.event1Label ?? 'Event 1',
            defaultValue: data.event1,
          },
          {
            type: 'boolean',
            name: 'event2',
            label: data.event2Label ?? 'Event 2',
            defaultValue: data.event2,
          },
          {
            type: 'boolean',
            name: 'event3',
            label: data.event3Label ?? 'Event 3',
            defaultValue: data.event3,
          },
          {
            type: 'boolean',
            name: 'event4',
            label: data.event4Label ?? 'Event 4',
            defaultValue: data.event4,
          },
          {
            type: 'boolean',
            name: 'event5',
            label: data.event5Label ?? 'Event 5',
            defaultValue: data.event5,
          },
        ],
      },
    ],
    acceptLabel: 'Save',
    cancelLabel: 'Cancel',
  }) as const,
  async (event, context) => {
    const values = event.values as {
      event1?: boolean;
      event2?: boolean;
      event3?: boolean;
      event4?: boolean;
      event5?: boolean;
    };

    const user = await context.reddit.getCurrentUser(); // pattern from dynamic forms [[Forms examples](https://developers.reddit.com/docs/capabilities/client/forms#examples)]
    const username = user?.username;
    if (!username) {
      await context.ui.showToast({ text: 'Could not detect your username.' });
      return;
    }

    // Update subscriptions in Redis
    await setUserSubscription(context.redis, username, 'event1', !!values.event1);
    await setUserSubscription(context.redis, username, 'event2', !!values.event2);
    await setUserSubscription(context.redis, username, 'event3', !!values.event3);
    await setUserSubscription(context.redis, username, 'event4', !!values.event4);
    await setUserSubscription(context.redis, username, 'event5', !!values.event5);

    await context.ui.showToast({ text: 'Subscriptions updated.' }); // toast pattern from forms docs [[Forms](https://developers.reddit.com/docs/capabilities/client/forms)]
  }
);

// ---- Menu item to open the form for the current user ----

Devvit.addMenuItem({
  label: '[Multipinger] Manage my event subscriptions',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const settings = await context.settings.getAll(); // documented access pattern [[Settings access](https://developers.reddit.com/docs/capabilities/server/settings-and-secrets#accessing-settings-in-your-app)]
    const user = await context.reddit.getCurrentUser();
    const username = user?.username;
    if (!username) {
      await context.ui.showToast({ text: 'Could not detect your username.' });
      return;
    }

    // Load current subs from Redis
    const current = await getUserSubscriptions(context.redis, username);

    // Show form with labels from settings and booleans from Redis
    await context.ui.showForm(manageMySubsForm, {
      event1Label: settings.event1Label as string | undefined,
      event2Label: settings.event2Label as string | undefined,
      event3Label: settings.event3Label as string | undefined,
      event4Label: settings.event4Label as string | undefined,
      event5Label: settings.event5Label as string | undefined,
      ...current,
    });
  },
}); */

Devvit.addTrigger({
  event: "AppInstall",
  async onEvent(event, context) {
    console.log(
      `App installed on r/${event.subreddit?.name} by ${event.installer?.name}.`,
    );

    const subreddit = await context.reddit.getCurrentSubreddit();

    var firstMsg = `Hello u/${event.installer?.name},\n\n`;

    firstMsg += `Thanks for installing **MultiPinger**!\n\n`;

    firstMsg += `This app allows you to send a message to multiple users at once, making coordinated moderator communication much easier.\n\n`;

    firstMsg += `To use this app, you need *Mail* permissions. If your team prefers stricter access, you can also require full moderator permissions (configure it here: https://developers.reddit.com/r/${subreddit.name}/apps/MultiPinger).\n\n`;

    firstMsg += `For security and audit purposes, the app automatically sends a copy of each multiping action to Modmail. This cannot be disabled at the moment, as it's the only reliable logging method. Once Reddit’s Wiki API is stable again, an optional Wiki-based log will be added.\n\n`;

    firstMsg += `Please use MultiPinger responsibly and avoid any activity that might be considered spam.\n\n`;

    firstMsg += `If you need help or want to suggest improvements, contact me (u/paskatulas) [here](https://reddit.com/message/compose?to=/r/paskapps&subject=App%20Feedback%3A%20Multipinger&message=Text%3A%20).\n\n`;

    await context.reddit.modMail.createConversation({
      subredditName: `${event.installer?.name}`,
      isAuthorHidden: false,
      subject: `Thanks for installing MultiPinger!`,
      body: firstMsg,
      to: null,
    });
  },
});

const mstForm = Devvit.createForm(
  {
    title: "MultiPinger",
    description: `MultiPinger is an app which can send a message to more users at once. Please don't use it for spam!`,
    fields: [
      {
        name: `userA`,
        label: "User(s)",
        type: "string",
        required: true,
      },
      {
        name: `subjectMM`,
        label: "Subject",
        type: "string",
        required: true,
      },
      {
        name: `textMM`,
        label: "Message",
        helpText: `Write something here.`,
        type: "paragraph",
        required: true,
      },
      {
        name: `img`,
        label: "Image",
        type: "image",
        helpText:
          "The image will be uploaded to Reddit (i.redd.it) and included as a link in the message. Modmail does not show image previews.",
        required: false,
      },
      {
        name: `displayModName`,
        label: "Send anonymously?",
        helpText:
          "If enabled, messages will be sent under the subreddit name. Disable to show your moderator username.",
        type: "boolean",
        defaultValue: true,
      },
    ],
    acceptLabel: "Send",
    cancelLabel: "Cancel",
  },
  async (_event, context) => {
    const { reddit, ui } = context;
    const author = _event.values.userA;
    const subreddit = await reddit.getCurrentSubreddit();
    const currentUser = await reddit.getCurrentUser();
    const showModName = _event.values.displayModName;
    const subjectText = _event.values.subjectMM;
    var messageText = `${_event.values.textMM}\n\n`;
    var image = _event.values.img;

    if (!image) {
    } else {
      messageText += `${image}`;
    }

    const usernames = author
      .split(",")
      .map((username: string) => username.trim());

    const successes: string[] = [];
    const failures: string[] = [];

    for (const username of usernames) {
      try {
        if (!showModName) {
          await reddit.modMail.createConversation({
            subredditName: subreddit.name,
            to: username, // "username" or "u/username" is allowed [[createConversation](https://developers.reddit.com/docs/api/redditapi/models/classes/ModMailService#createconversation)]
            isAuthorHidden: false,
            subject: subjectText,
            body: messageText,
          });
        } else {
          console.log("Sending anonymously...");

          await reddit.modMail.createConversation({
            subredditName: subreddit.name,
            to: username, // "username" or "u/username" is allowed [[createConversation](https://developers.reddit.com/docs/api/redditapi/models/classes/ModMailService#createconversation)]
            isAuthorHidden: true,
            subject: subjectText,
            body: messageText,
          });
          successes.push(username);
        }
      } catch (err) {
        console.error(`Failed to send to ${username}`, err);
        failures.push(username);
        // continue to next username
      }
    }

    let result = "";
    if (successes.length) {
      result += `Message sent to: ${successes.join(", ")}. `;
    }
    if (failures.length) {
      result += `Failed to send to: ${failures.join(", ")}.`;
    }

    console.log(`${currentUser?.username} bulk message result: ${result}`);
    ui.showToast(result || "No messages were sent.");

    const formatUsers = (users: string[]) =>
      users.length ? users.map((u) => `u/${u}`).join(", ") : "_None_";

    // Build summary for mods
    const summarySubject = `Bulk user message by u/${currentUser?.username}: ${subjectText}`;
    const summaryBody = [
      `**Sender:** u/${currentUser?.username}`,
      `**Subreddit:** r/${subreddit.name}`,
      `**Original subject:** ${subjectText}`,
      "",
      "**Original body:**",
      messageText,
      "",
      `**Successful recipients (${successes.length}):** ${formatUsers(successes)}`,
      `**Failed recipients (${failures.length}):** ${formatUsers(failures)}`,
    ].join("\n\n");

    const sendModmail = (await context?.settings.get("sendModmail")) as boolean;
    if (!sendModmail) {
      console.log("Not sending a copy.");
    } else {
      console.log("Sending a copy to Modmail...");

      // Send copy to mods via Modmail
      await reddit.modMail.createConversation({
        subredditName: subreddit.name,
        subject: summarySubject,
        body: summaryBody,
        to: null,
      });
    }
  },
);

Devvit.addMenuItem({
  location: "subreddit",
  forUserType: "moderator",
  label: "MultiPinger",
  description: "Send a message to multiple users at once.",
  onPress: async (_event, context) => {
    const { ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const appUser = await context.reddit.getCurrentUser();
    const perms = await appUser?.getModPermissionsForSubreddit(subreddit.name);
    const fullPermsRequirement =
      await context.settings.get<boolean>("allPerms");

    if (!fullPermsRequirement) {
      console.log("No full permissions requirement!");
      if (perms?.includes("mail") || perms?.includes("all")) {
        console.log(
          `${appUser?.username} has needed permissions (${perms}), ok!`,
        );
        context.ui.showForm(mstForm);
      } else {
        console.log(`${appUser?.username} has no permissions (${perms})!`);
        return ui.showToast(`You don't have the necessary permissions.`);
      }
    } else if (fullPermsRequirement && perms?.includes("all")) {
      console.log("Full permissions required!");
      console.log(`${appUser?.username} has full permissions (${perms}), ok!`);
      context.ui.showForm(mstForm);
    } else {
      console.log(`${appUser?.username} has no permissions (${perms})!`);
      return ui.showToast(`You don't have the necessary permissions.`);
    }
  },
});

Devvit.addTrigger({
  event: "ModMail",
  async onEvent(event, context) {
    const autoArchiving = await context.settings.get<boolean>("autoArchive");

    if (!autoArchiving) {
      console.log("Subreddit has disabled auto-archiving app messages.");
    } else {
      console.log(
        "Subreddit has enabled (default setting) auto-archiving app messages.",
      );
      try {
        if (event.messageAuthor?.name.includes("multipinger")) {
          console.log(
            `Archiving bot message conversation with ID: ${event.conversationId}`,
          );

          await context.reddit.modMail.archiveConversation(
            event.conversationId,
          );

          console.log(
            `Archived bot message conversation with ID: ${event.conversationId} successfully`,
          );
        } else {
          console.log(
            "Skipped archiving: Author or subject conditions not met.",
          );
        }
      } catch (error) {
        console.error("Error archiving bot messages:", error);
      }
    }
  },
});

/* const manageUserSubsForm = Devvit.createForm(
  (data: {
    event1Label?: string;
    event2Label?: string;
    event3Label?: string;
    event4Label?: string;
    event5Label?: string;
    event1?: boolean;
    event2?: boolean;
    event3?: boolean;
    event4?: boolean;
    event5?: boolean;
    username?: string;
  }) => ({
    title: 'Manage user event subscriptions',
    fields: [
      {
        type: 'string',
        name: 'username',
        label: 'Username (without u/)',
        defaultValue: data.username,
        required: true,
      },
      {
        type: 'group',
        label: 'Events',
        fields: [
          { type: 'boolean', name: 'event1', label: data.event1Label ?? 'Event 1', defaultValue: data.event1 },
          { type: 'boolean', name: 'event2', label: data.event2Label ?? 'Event 2', defaultValue: data.event2 },
          { type: 'boolean', name: 'event3', label: data.event3Label ?? 'Event 3', defaultValue: data.event3 },
          { type: 'boolean', name: 'event4', label: data.event4Label ?? 'Event 4', defaultValue: data.event4 },
          { type: 'boolean', name: 'event5', label: data.event5Label ?? 'Event 5', defaultValue: data.event5 },
        ],
      },
    ],
  }) as const,
  async (event, context) => {
    const { username, event1, event2, event3, event4, event5 } = event.values as any;
    if (!username) return;

    // Update subscription storage for this username using your helpers.

    await context.ui.showToast({ text: `Updated subscriptions for u/${username}` });
  }
);

Devvit.addMenuItem({
  label: '[Multipinger] Manage user event subs',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const settings = await context.settings.getAll();
    // Optionally, you could first ask for username, then look up current subs
    // and call showForm(manageUserSubsForm, { username, ...current }).

    context.ui.showForm(manageUserSubsForm, {
      event1Label: settings.event1Label as string | undefined,
      event2Label: settings.event2Label as string | undefined,
      event3Label: settings.event3Label as string | undefined,
      event4Label: settings.event4Label as string | undefined,
      event5Label: settings.event5Label as string | undefined,
    });
  },
}); */

/* Devvit.addMenuItem({
  label: '[Multipinger] Send bulk message to event subscribers',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const settings = await context.settings.getAll();
    const subreddit = await context.reddit.getCurrentSubreddit();
    if (!subreddit) return;

    const eventKey: EventKey = 'event1'; // or chosen via a form

    const subjectText = settings[`${eventKey}Subject`] as string;
    const messageText = settings[`${eventKey}Body`] as string;

    // FIX: pass redis + eventKey
    const usernames = await getSubscribers(context.redis, eventKey);

    const successes: string[] = [];
    const failures: string[] = [];

    for (const username of usernames) {
      try {
        await context.reddit.modMail.createConversation({
          subredditName: subreddit.name,
          to: username,
          isAuthorHidden: false,
          subject: subjectText,
          body: messageText,
        });
        successes.push(username);
      } catch (err) {
        console.error(`Failed to send to ${username}`, err);
        failures.push(username);
      }
    }

    const formatUsers = (users: string[]) =>
      users.length ? users.map((u) => `u/${u}`).join(', ') : '_None_';

    await context.ui.showToast({
      text: `Sent: ${successes.length}, Failed: ${failures.length}`,
    });

    await context.reddit.modMail.createConversation({
      subredditName: subreddit.name,
      subject: `Bulk message to ${eventKey} subscribers`,
      body: [
        `**Event:** ${eventKey}`,
        `**Subject:** ${subjectText}`,
        '',
        '**Body:**',
        messageText,
        '',
        `**Successful recipients (${successes.length}):** ${formatUsers(successes)}`,
        `**Failed recipients (${failures.length}):** ${formatUsers(failures)}`,
      ].join('\n\n'),
    });
  },
}); */

export default Devvit;
