import { ModAction } from '@devvit/protos';
import {
  Devvit,
  MenuItemOnPressEvent,
  ModMailConversationState,
  RedditAPIClient,
  ModNote,
  ConversationUserData,
  ModMailActionType,
  PrivateMessage,
  WithUserData,
  ConversationResponse,
  ModMailService,
  AddRemovalNoteOptions,
  MenuItemUserType,
  MenuItemLocation,
  MenuItem,
  Comment,
  getModerationLog,
} from '@devvit/public-api';
import { sub } from 'date-fns';
import { isModerator } from 'devvit-helpers';

Devvit.configure({
  redditAPI: true,
  redis: true,
  realtime: true,
  http: true,
});

Devvit.addSettings([
  {
    type: 'boolean',
    name: 'sendModmail',
    label: 'Send to Modmail?',
    helpText: 'Choose this if you want to receive notifications about AEO removals to Modmail',
    defaultValue: true,
  },
  {
    type: 'boolean',
    name: 'sendDiscord',
    label: 'Send to Discord?',
    helpText: 'Choose this if you want to receive notifications about AEO removals to your Discord server',
    defaultValue: false,
  },
  {
    type: 'string',
    name: 'webhook',
    label: 'Webhook URL (Discord)',
  },
  {
    type: 'string',
    name: 'discordRole',
    label: 'Role ID to ping (Discord)',
  },

]);


  Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) { 

  const subreddit = await context.reddit.getCurrentSubreddit();

  var firstMsg = `Hello r/${subreddit.name},\n\n`;

  firstMsg += `Thanks for installing AEO tracker!\n\n`,

  firstMsg += `This app will alert you whenever AEO actions require attention. It includes context (title, body, URL) and a link to ModSupport for quick action.\n\n`,

  firstMsg += `Just a heads up, you're automatically opted into receiving alerts via modmail for AEO removals. However, if you prefer not to receive these alerts, you can opt out at any time [here](https://developers.reddit.com/r/${subreddit.name}/apps/aeo-tracker).\n\n`,

  firstMsg += `Also, app can send alerts directly to your Discord server. To enable this feature, please paste the webhook [here](https://developers.reddit.com/r/${subreddit.name}/apps/aeo-tracker).\n\n`;

  firstMsg += `[Terms & conditions](https://www.reddit.com/r/paskapps/wiki/aeo-tracker/terms-and-conditions/) | [Privacy Policy](https://www.reddit.com/r/paskapps/wiki/aeo-tracker/privacy-policy/) | [Contact](https://reddit.com/message/compose?to=paskatulas&subject=AEO%20Tracker&message=Text%3A%20)\n\n\n`

    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: 'aeo-tracker',
      subject: `First message`,
      text: firstMsg
    })

  }});


Devvit.addTrigger({
  event: 'ModAction',
  async onEvent(event, context) {
  
    const subreddit = await context.reddit.getCurrentSubreddit();
    const webhook = await context?.settings.get('webhook') as string;
    const sendtoModmail = await context?.settings.get('sendModmail') as boolean;
    const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;

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


    if (event.targetComment?.body.split("\n\n").join("\n\n> ") == '[ Removed by Reddit ]' && event.action == 'removecomment') {

      console.log('Found possible removecomment action by AEO...')

      let comText = `**Target user**: u/${event.targetUser?.name}\n\n`;
    
      comText += `**Removed content**:\n\n`;
    
      comText += `> ${event.targetComment?.body}\n\n`;
    
      comText += `**Link**: https://reddit.com${event.targetComment?.permalink}\n\n`;
    
      comText += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;
    
      comText += `Also, if you want to report the bug, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;

      comText += `*If you prefer not to receive these alerts in Modmail, you can opt out at any time [here](https://developers.reddit.com/r/${subreddit.name}/apps/aeo-tracker).*\n\n`;
    
      if (sendtoModmail == false) {
        console.log("Not sending to Modmail, skipping...");
      }
      else {
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: 'aeo-tracker',
        subject: `Alert - possible comment removal by AEO`,
        text: comText,
      })
    };

      let payload;

      if (!webhook) {
        console.error('No webhook URL provided');
        return;
      }
      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        if (discordRole) {
            discordAlertMessage = `<@&${discordRole}> **Hey mods, AEO has removed something!**\n\n`;
            discordAlertMessage += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;
            discordAlertMessage += `Also, if you want to report the bug, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;
            discordAlertMessage += `*If you prefer not to receive these alerts on Discord, you can opt out at any time [here](https://developers.reddit.com/r/${subreddit.name}/apps/aeo-tracker).*\n\n`;
          } else {
          discordAlertMessage = `**Hey mods, AEO has removed something!**\n\n`;
          discordAlertMessage += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;
          discordAlertMessage += `Also, if you want to report the bug, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;
          discordAlertMessage += `*If you prefer not to receive these alerts on Discord, you can opt out at any time [here](https://developers.reddit.com/r/${subreddit.name}/apps/aeo-tracker).*\n\n`;

        }
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
      {
        title: `${event.targetComment?.body}`,
        url: `https://reddit.com${event.targetComment?.permalink}`,
        fields: [
          {
            name: 'Subreddit',
            value: `r/${subreddit.name}`,
            inline: true,
          },
          {
            name: 'Moderator',
            value: `${event.moderator?.name}`, // this returns the username of admin/moderator who removed the comment
            inline: true,
          },
          {
            name: 'Target User',
            value: `${event.targetUser?.name}`,
            inline: true,
          },
          {
            name: 'Action',
            value: `Comment removal`,
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

  if (sendtoDiscord == false) {
      console.log("Not sending to Discord, skipping...");
    }
    else {
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
        

  } catch (err) {
    console.error(`Error sending alert: ${err}`);
  }
};
        }
    if (event.targetPost?.title == '[ Removed by Reddit ]') {
      {
    console.log('Found removelink action by AEO...')

    // now, post removal

    var pText = `**Target user**: u/${event.targetUser?.name}\n\n`;

    pText += `**Removed content**:\n\n`;

    pText += `> ${event.targetPost?.title}\n\n`;

    pText += `**Link**: https://reddit.com${event.targetPost?.permalink}\n\n`;

    pText += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;

    pText += `Also, if you want to report the bug, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;

    pText += `*If you prefer not to receive these alerts in Modmail, you can opt out at any time [here](https://developers.reddit.com/r/${subreddit.name}/apps/aeo-tracker).*\n\n`;

    if (sendtoModmail == false) {
      console.log("Not sending to Modmail, skipping...");
    }
    else {
    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: 'aeo-tracker',
      subject: `Alert - possible post removal by AEO`,
      text: pText,
    });
  }

    let payload;

      if (!webhook) {
        console.error('No webhook URL provided');
        return;
      }
      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        if (discordRole) {
            discordAlertMessage = `<@&${discordRole}> **Hey mods, AEO has removed something!**\n\n`;
            discordAlertMessage += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;
            discordAlertMessage += `Also, if you want to report the bug, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;
            discordAlertMessage += `*If you prefer not to receive these alerts on Discord, you can opt out at any time [here](https://developers.reddit.com/r/${subreddit.name}/apps/aeo-tracker).*\n\n`;
          } else {
          discordAlertMessage = `**Hey mods, AEO has removed something!**\n\n`;
          discordAlertMessage += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;
          discordAlertMessage += `Also, if you want to report the bug, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;
          discordAlertMessage += `*If you prefer not to receive these alerts on Discord, you can opt out at any time [here](https://developers.reddit.com/r/${subreddit.name}/apps/aeo-tracker).*\n\n`;
        }
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
      {
        title: `${event.targetPost?.title}`,
        url: `https://reddit.com${event.targetPost?.permalink}`,
        fields: [
          {
            name: 'Subreddit',
            value: `r/${subreddit.name}`,
            inline: true,
          },
          {
            name: 'Moderator',
            value: `${event.moderator?.name}`, // this returns the username of admin/moderator who removed the post
            inline: true,
          },
          {
            name: 'Target User',
            value: `${event.targetUser?.name}`,
            inline: true,
          },
          {
            name: 'Action',
            value: `Post removal`,
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

  if (sendtoDiscord == false) {
    console.log("Not sending to Discord, skipping...");
  }
  else {
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

  } catch (err) {
    console.error(`Error sending alert: ${err}`);
  }
}
  return;
        };
  }
}

  else {
    console.log("Not an AEO action, ignoring...");
  }
  
}
} catch(error) {
  console.error('Error getting mod logs:', error);
}
}
});

export default Devvit;