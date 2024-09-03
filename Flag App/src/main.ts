import { Devvit, FormOnSubmitEvent } from '@devvit/public-api';
import {isModerator, hasPerformedActions, replacePlaceholders, getRecommendedPlaceholdersFromModAction, assembleRemovalReason, submitPostReply, ignoreReportsByPostId, setLockByPostId, isBanned} from "devvit-helpers";

Devvit.configure({
  redditAPI: true, // Enable access to the Reddit API
  http: true
});

Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) {
  
    console.log(`App installed on r/${event.subreddit?.name} by ${event.installer?.name}.`);

    const subreddit = await context.reddit.getCurrentSubreddit();

    var firstMsg = `Hello r/${subreddit.name} mods,\n\n`;
    
    firstMsg += `Thanks for installing Flag App!\n\n`,
    
    firstMsg += `This intuitive tool allows your approved users to easily flag the inappropriate content. Here is how it works:\n\n`,

    firstMsg += `* **User flagging**: [Approved users](https://developers.reddit.com/r/${subreddit.name}/apps/flag-app) can flag content they find inappropriate with choosing a correct flag reason and writing context.\n\n`;

    firstMsg += `* **Immediate action**: Once flagged, the content is automatically removed (by default).\n\n`;

    firstMsg += `* **Notifications**: Both the user and mods will be notified via Modmail.\n\n`;

    firstMsg += `Also, Flag App supports Discord integration (you can configure it [here](https://developers.reddit.com/r/${subreddit.name}/apps/flag-app)), you can set to receive notifications after each flag.\n\n`,
        
    firstMsg += `[Terms & conditions](https://www.reddit.com/r/paskapps/wiki/flag-app/terms-and-conditions/) | [Privacy Policy](https://www.reddit.com/r/paskapps/wiki/flag-app/privacy-policy/) | [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=FlagApp&message=Text%3A%20)\n\n\n`;

    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: 'flag-app',
      subject: `Thanks for installing Flag App!`,
      text: firstMsg
    })
}
}
); 

export enum SettingName{
  LegitUsers = "legitUsers",
};


Devvit.addSettings([
  {
    name: SettingName.LegitUsers,
    type: "string",
    label: "A list of legit users",
  },
  {
    type: 'boolean',
    name: 'toRemove',
    label: 'Remove flagged content?',
    defaultValue: true
  },
  {
    type: 'boolean',
    name: 'sendModmail',
    label: 'Send to Modmail?',
    helpText: `Choose this if you'd like to receive notification in Modmail.`,
    defaultValue: true
  },
  {
    type: 'group',
    label: 'Discord',
    helpText: 'Notify moderators on the Discord server.',
    fields: [
      {
        type: 'boolean',
        name: 'sendDiscord',
        label: 'Send to Discord?',
        helpText: `Choose this if you'd like to receive notification on the Discord server.`
      },
      {
        type: 'string',
        name: 'webhookReport',
        label: 'Webhook URL',
      },
      {
        type: 'string',
        name: 'discordRole',
        label: 'Role ID to ping',
      },
    ]
  },
]);

export const flagThePost = Devvit.createForm(
  ({ reasons }) => {
    const reasonsOptions = reasons.map((reason: any) => {
      return { label: reason.title, value: reason.title };
    });

    return {
      fields: [
        { name: 'flagReason', label: `Reason`, options: reasonsOptions, helpText: `Choose a flag reason`, type: 'select', required: true, },
        { name: 'flagContext', label: `Note`, type: 'paragraph', placeholder: `Note to mods`, helpText: `By clicking Flag, you confirm that you are aware that the moderators can see who flags and that you are not abusing this option.`},
      ],
      title: 'Flag form',
      acceptLabel: 'Flag',
    };
  },
  async (_event, context) => {
  const { reddit, ui } = context;

  const reporter = await context.reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const post = (await context.reddit.getPostById(context.postId!));

  const sendtoModmail = await context?.settings.get('sendModmail') as boolean;
  const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;


  const commandRemove = await context?.settings.get('toRemove') as boolean;

  if (!reporter){
    return console.error(`Unknown reporter.`);
  };


  var tMessage = `Hello u/${reporter?.username},\n\n`;

  tMessage += `Thanks for flagging! We'll review this report and, if necessary, we'll ask for more details.\n\n`;

  tMessage += `**Report details**\n\n`;

  tMessage += `Content from [${post.authorName}](${post.permalink})\n\n`;

  tMessage += `**Report reason**: ${_event.values.flagReason}\n\n`;

  if (_event.values.flagContext){
    tMessage += `**Context**: ${_event.values.flagContext}\n\n`;
  };

  tMessage += `~ r/${subreddit.name} Mod Team\n\n\n`;

  if (!post){
    return ui.showToast(`This content is deleted or already removed by mods!`);
  }
    else {
      if (commandRemove == true){
      post.remove();
      };
  if (!_event.values.flagContext){
    await context.reddit.report(post, {
      reason: `${reporter?.username}: ${_event.values.flagReason}`,
     })
     ui.showToast(`Flagged, thanks!`);

     if (sendtoModmail == false) {
      console.log("Not sending to Modmail, skipping...");
    } else {

     await reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: reporter?.username,
      subject: `Submission report`,
      text: tMessage,
    }); };

    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: post.authorName,
        note: `Submission flagged by ${reporter?.username} - ${_event.values.flagReason}.`,
        label: 'SPAM_WARNING',
        redditId: post.id
      }
    );
    }
    else {
  await context.reddit.report(post, {
    reason: `${reporter?.username}: ${_event.values.flagReason} (context)`,
   })
   ui.showToast(`Flagged, thanks!`);

   if (sendtoModmail == false) {
    console.log("Not sending to Modmail, skipping...");
  } else {

   await reddit.sendPrivateMessageAsSubreddit({
    fromSubredditName: subreddit.name,
    to: reporter?.username,
    subject: `Submission report`,
    text: tMessage,
  });
};

  await context.reddit.addModNote(
    {
      subreddit: subreddit.name,
      user: post.authorName,
      note: `Submission flagged by ${reporter?.username} - ${_event.values.flagReason} (${_event.values.flagContext}).`,
      label: 'SPAM_WARNING',
      redditId: post.id
    }
  );

  };
};

  const webhook = await context?.settings.get('webhookReport') as string;

    console.log(`Received Flag trigger event:\n${JSON.stringify(_event)}`);

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

      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        if (discordRole) {
            discordAlertMessage = `<@&${discordRole}>\n\n`;
        } else {
          discordAlertMessage = ``;
        };
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");

          if (_event.values.flagContext){
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
      {
        title: `${post.title}`,
        url: `https://reddit.com${post.permalink}`,
        fields: [
          {
            name: 'Subreddit',
            value: `r/${subreddit.name}`,
            inline: true,
          },
          {
            name: 'Reporter',
            value: `${reporter?.username}`,
            inline: true,
          },
          {
            name: 'Target User',
            value: `${post.authorName}`,
            inline: true,
          },
          {
            name: 'Reason',
            value: `${_event.values.flagReason}`,
            inline: true,
          },
          {
            name: 'Context',
            value: `${_event.values.flagContext}`,
            inline: true,
          },
          {
            name: 'Score',
            value: `${post.score}`,
            inline: true,
          },
        ],
      },
    ],
  }
}
else {
  payload = {
    content: discordAlertMessage,
    embeds: [
{
  title: `${post.title}`,
  url: `https://reddit.com${post.permalink}`,
  fields: [
    {
      name: 'Subreddit',
      value: `r/${subreddit.name}`,
      inline: true,
    },
    {
      name: 'Reporter',
      value: `${reporter?.username}`,
      inline: true,
    },
    {
      name: 'Target User',
      value: `${post.authorName}`,
      inline: true,
    },
    {
      name: 'Reason',
      value: `${_event.values.flagReason}`,
      inline: true,
    },
    {
      name: 'Score',
      value: `${post.score}`,
      inline: true,
    },
  ],
},
],
}
};
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
);

export const flagTheComment = Devvit.createForm(
  ({ reasons }) => {
    const reasonsOptions = reasons.map((reason: any) => {
      return { label: reason.title, value: reason.title };
    });

    return {
      fields: [
        { name: 'flagReason', label: `Reason`, options: reasonsOptions, helpText: `Choose a flag reason`, type: 'select', required: true, },
        { name: 'flagContext', label: `Note`, type: 'paragraph', placeholder: `Note to mods`, helpText: `By clicking Flag, you confirm that you are aware that the moderators can see who flags and that you are not abusing this option.`},
      ],
      title: 'Flag form',
      acceptLabel: 'Flag',
    };
  },
  async (_event, context) => {
  const { reddit, ui } = context;


  const reporter = await context.reddit.getCurrentUser();
  const subreddit = await reddit.getCurrentSubreddit();
  const comment = (await context.reddit.getCommentById(context.commentId!));

  const sendtoModmail = await context?.settings.get('sendModmail') as boolean;
  const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;

  const commandRemove = await context?.settings.get('toRemove') as boolean;

  if (!reporter){
    return console.error(`Unknown reporter.`);
  };

  var tMessage = `Hello u/${reporter?.username},\n\n`;

  tMessage += `Thanks for flagging! We'll review this report and, if necessary, we'll ask for more details.\n\n`;

  tMessage += `**Report details**\n\n`;

  tMessage += `Content from [${comment.authorName}](${comment.permalink})\n\n`;

  tMessage += `**Report reason**: ${_event.values.flagReason}\n\n`;

  if (_event.values.flagContext){
    tMessage += `**Context**: ${_event.values.flagContext}\n\n`;
  };

  tMessage += `~ r/${subreddit.name} Mod Team\n\n\n`;

  if (!comment.id){
    return ui.showToast(`This content is deleted or already removed.`);
  }
    else {
      if (commandRemove == true){
        comment.remove();
        };
  if (!_event.values.flagContext){
    await context.reddit.report(comment!, {
      reason: `${reporter?.username}: ${_event.values.flagReason}`,
     })
     ui.showToast(`Flagged, thanks!`);

     if (sendtoModmail == false) {
      console.log("Not sending to Modmail, skipping...");
    } else {
     await reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: reporter?.username,
      subject: `Comment report`,
      text: tMessage,
    });
  };

    await context.reddit.addModNote(
      {
        subreddit: subreddit.name,
        user: comment.authorName,
        note: `Comment flagged by ${reporter?.username} - ${_event.values.flagReason}.`,
        label: 'SPAM_WARNING',
        redditId: comment.id
      });

    }
    else {
  await context.reddit.report(comment!, {
    reason: `${reporter?.username}: ${_event.values.flagReason} (context)`,
   })
   ui.showToast(`Flagged, thanks!`);

   if (sendtoModmail == false) {
    console.log("Not sending to Modmail, skipping...");
  } else {

   await reddit.sendPrivateMessageAsSubreddit({
    fromSubredditName: subreddit.name,
    to: reporter?.username,
    subject: `Comment report`,
    text: tMessage,
  });
};

  await context.reddit.addModNote(
    {
      subreddit: subreddit.name,
      user: comment.authorName,
      note: `Comment flagged by ${reporter?.username} - ${_event.values.flagReason} (${_event.values.flagContext}).`,
      label: 'SPAM_WARNING',
      redditId: comment.id
    });

  };
};
const webhook = await context?.settings.get('webhookReport') as string;


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

      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        if (discordRole) {
            discordAlertMessage = `<@&${discordRole}>\n\n`;
        } else {
          discordAlertMessage = ``;
        };
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");

          if (_event.values.flagContext){
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
      {
        title: `${reporter?.username} has flagged something!`,
        url: `https://reddit.com${comment.permalink}`,
        fields: [
          {
            name: 'Subreddit',
            value: `r/${subreddit.name}`,
            inline: true,
          },
          {
            name: 'Reporter',
            value: `${reporter?.username}`,
            inline: true,
          },
          {
            name: 'Target User',
            value: `${comment.authorName}`,
            inline: true,
          },
          {
            name: 'Reason',
            value: `${_event.values.flagReason}`,
            inline: true,
          },
          {
            name: 'Context',
            value: `${_event.values.flagContext}`,
            inline: true,
          },
          {
            name: 'Score',
            value: `${comment.score}`,
            inline: true,
          },
        ],
      },
    ],
  }
}
else {
  payload = {
    content: discordAlertMessage,
    embeds: [
{
  title: `${reporter?.username} has flagged something!`,
  url: `https://reddit.com${comment.permalink}`,
  fields: [
    {
      name: 'Subreddit',
      value: `r/${subreddit.name}`,
      inline: true,
    },
    {
      name: 'Reporter',
      value: `${reporter?.username}`,
      inline: true,
    },
    {
      name: 'Target User',
      value: `${comment.authorName}`,
      inline: true,
    },
    {
      name: 'Reason',
      value: `${_event.values.flagReason}`,
      inline: true,
    },
    {
      name: 'Score',
      value: `${comment.score}`,
      inline: true,
    },
  ],
},
],
  };
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
);


Devvit.addMenuItem({
  location: 'post',
  label: 'Flag (P)',
  description: 'Flag the post',
  onPress: async (_event, context) => {
    const { ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const reporter = await context.reddit.getCurrentUser();

    if (!reporter){
      return console.error(`Unknown reporter.`);
    };

    const checkMod = await isModerator(context.reddit, subreddit.name, reporter?.username);

    let reasons = await context.reddit.getSubredditRemovalReasons(subreddit.name);

    const settings = await context.settings.getAll();

    const legitUserSetting = settings[SettingName.LegitUsers] as string ?? "";
    const legitUsers = legitUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (legitUsers.includes(reporter?.username.toLowerCase()) || checkMod) {
      console.log(`${reporter?.username} is a legit user or a mod, okay.`);
      return context.ui.showForm(flagThePost, { reasons: reasons });
  } else {
    console.log(`${reporter?.username} is not a legit user, nor a mod.`);
    return ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

Devvit.addMenuItem({
  location: 'comment',
  label: 'Flag (C)',
  description: 'Flag the comment',
  onPress: async (_event, context) => {
    const { ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const reporter = await context.reddit.getCurrentUser();


    if (!reporter){
      return console.error(`Unknown reporter.`);
    };

    const checkMod = await isModerator(context.reddit, subreddit.name, reporter?.username);

    if (!reporter){
      return console.error(`Unknown reporter.`);
    };

    let reasons = await context.reddit.getSubredditRemovalReasons(subreddit.name);
    const settings = await context.settings.getAll();

    const legitUserSetting = settings[SettingName.LegitUsers] as string ?? "";
    const legitUsers = legitUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (legitUsers.includes(reporter?.username.toLowerCase()) || checkMod) {
      console.log(`${reporter?.username} is a legit user or a mod, okay.`);
      return context.ui.showForm(flagTheComment, { reasons: reasons });
  } else {
    console.log(`${reporter?.username} is not a legit user, nor a mod.`);
    return ui.showToast("Sorry, you are not allowed to do that!");
  };
  },
});

export default Devvit;
