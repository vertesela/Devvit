import { Comment } from '@devvit/protos';
import { Devvit, WikiPage, WikiPagePermissionLevel,} from '@devvit/public-api';
import { Paragraph } from '@devvit/shared-types/richtext/types.js';
import {isModerator, submitPostReply, setLockByPostId, isBanned} from "devvit-helpers";

Devvit.configure({
  redditAPI: true, // Enable access to Reddit API
  http: true
});

export enum SettingName{
  TrustedUsers = "trustedUsers",
};

Devvit.addSettings([
  {
    name: SettingName.TrustedUsers,
    type: "string",
    label: "List of trusted users who can use the app",
  },
  {
    name: 'OPoption',
    type: "boolean",
    label: "Allow OP to pin the comment?",
    defaultValue: false
  },
  {
    name: 'autoLock',
    type: "boolean",
    label: "Auto-lock app comments",
    defaultValue: true
  },
  {
    type: 'boolean',
    name: 'sendModmail',
    label: 'Send to Modmail?',
    helpText: `Choose this if you'd like to receive notification for mod pinnings in Modmail.`,
    defaultValue: false
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
        helpText: `Choose this if you'd like to receive notification for mod pinnings on the Discord server.`
      },
      {
        type: 'string',
        name: 'webhook',
        label: 'Webhook URL',
      },
      {
        type: 'string',
        name: 'discordRole',
        label: 'Role ID to ping',
      },
    ]
  },
  {
    type: 'group',
    label: 'Notification',
    helpText: 'Notify user about pinning the comment.',
    fields: [
      {
        name: 'alertUser',
        type: "boolean",
        label: "Send a notification to user for pinning the comment",
        defaultValue: false
      },
      {
        type: 'boolean',
        name: 'autoArchive',
        label: 'Auto-archive app messages?',
        helpText: `If true, app will automatically archive app-messages. `,
        defaultValue: true,
      },
    ]
  },
  {
    type: 'group',
    label: 'Pinned Post Flair',
    helpText: 'Automatically update flair when a comment is spotlighted',
    fields: [
      {
        name: 'setFlair',
        type: "boolean",
        label: "Enable auto-flair on pin?",
        defaultValue: false
      },
      {
        type: 'string',
        name: 'spotlightPostFlairText',
        label: 'Flair label to apply',
        defaultValue: `Context Provided - Spotlight`,
      },
    ]
  }
]);

Devvit.addMenuItem({
location: 'comment',
label: 'Spotlight',
description: 'Pin this comment',
onPress: async (_event, context) => {
  const { ui } = context;

  const subreddit = await context.reddit.getCurrentSubreddit();
  const currentUser = await context.reddit.getCurrentUser();
  const appUser = await context.reddit.getCurrentUser();
  const commentId = await context.commentId!;
  const modName = await context.reddit.getCurrentUser();
  const originalComment = (await context.reddit.getCommentById(commentId));
  const postID = originalComment.postId;
  const post = context.reddit.getPostById(postID);
  const commentLink = (await context.reddit.getCommentById(commentId)).permalink;
  const perms = await currentUser?.getModPermissionsForSubreddit(subreddit.name);
  const originalPoster = (await post).authorName;
  const OPoption = await context.settings.get<boolean>(('OPoption'));



  const spotlighter = await context.reddit.getCurrentUser();

  if (!spotlighter){
    return ui.showToast("Spotlighter not found!");
  }

    const settings = await context.settings.getAll();
    const trustedUserSetting = settings[SettingName.TrustedUsers] as string ?? "";
    const trustedUsers = trustedUserSetting.split(",").map(user => user.trim().toLowerCase());

    const isTrustedUser = trustedUsers.includes(spotlighter?.username.toLowerCase());
    const isModWithPerms = perms?.includes('posts') || perms?.includes('all');
    const isOriginalPoster = spotlighter?.username === originalPoster;


    if (OPoption) {
      console.log(`OP pinning is enabled on ${subreddit.name}.`);
      
      if (isOriginalPoster) {
        console.log(`${spotlighter?.username} is the OP.`);
      ui.showForm(pinThatCommentAsOP);
      return;
    } else {
      console.log(`${spotlighter?.username} is not the OP.`);
  }
}

if (isModWithPerms) {
  console.log(`${spotlighter?.username} is a moderator with sufficient permissions.`);
  ui.showForm(pinThatCommentAsMod);
  return;
}

if (isTrustedUser) {
  console.log(`${spotlighter?.username} is on the trusted user list.`);
  ui.showForm(pinThatCommentAsTrustedUser);
  return;
}

console.log(`${spotlighter?.username} is not allowed to pin comments.`);
ui.showToast("You're not allowed to use Spotlight on this subreddit.");


        function CurrentCETDateTime(): string {
          const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
          return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
      }
    
        const wikiPageName = "spotlight/logs";
          let wikiPage: WikiPage | undefined;
        try {
            wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
        } catch {
            //
        }
    
          var pageContents = `${wikiPage?.content}\n\n`;
          pageContents += `⛔ ${CurrentCETDateTime()} - u/${modName?.username} attempted to pin [this comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}. **Reason**: NOT_A_TRUSTED_USER\n\n`;
          pageContents += `---\n\n`;
    
          const wikiPageOptions = {
            subredditName: subreddit.name,
            page: wikiPageName,
            content: pageContents,
            reason: "Logs updated",
        };
      
    
        if (wikiPage) {
            await context.reddit.updateWikiPage(wikiPageOptions);
        } else {
            await context.reddit.createWikiPage(wikiPageOptions);
            await context.reddit.updateWikiPageSettings({
                subredditName: subreddit.name,
                page: wikiPageName,
                listed: true,
                permLevel: WikiPagePermissionLevel.MODS_ONLY,
            });
        }
        console.log("Logs page edited.");  
}
});

Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) {
  
    console.log(`App installed on r/${event.subreddit?.name}.`);

    const subreddit = await context.reddit.getCurrentSubreddit();

    var firstMsg = `Hello r/${subreddit.name} mods,\n\n`;
    
    firstMsg += `Thanks for installing Spotlight!\n\n`,
    
    firstMsg += `This intuitive tool allows your trusted users and OPs to pin comments from other users.\n\n`,

    firstMsg += `Users can write comments through a simple form and mods are able to pin user's comments by clicking "Pin that comment".\n\n`,
    
    firstMsg += `You can set a list of trusted users [here](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app).\n\n`,
    
    firstMsg += `[Instructions](https://www.reddit.com/r/paskapps/comments/1f8cmde/introducing_spotlight_an_app_that_allows_op_and/) | [Recent uses](https://reddit.com/r/${subreddit.name}/w/spotlight/logs) | [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n\n`



    function CurrentCESTDateTime(): string {
      const cestTime = new Date(Date.now() + 2 * 60 * 60000); // CEST is UTC+2
      return cestTime.toISOString().slice(0, 19).replace('T', ' ') + ' CEST';
    }

    const wikiPageName = "spotlight";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    var pageContents = `* [Instructions](https://www.reddit.com/r/paskapps/comments/1f8cmde/introducing_spotlight_an_app_that_allows_op_and/)\n\n`;
    pageContents += `* [Config](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)\n\n`;
    pageContents += `* [Logs](https://reddit.com/r/${subreddit.name}/w/spotlight/logs)\n\n`;
    pageContents += `* [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n`;
    pageContents += `---\n\n`;

      const wikiPageOptions = {
        subredditName: subreddit.name,
        page: wikiPageName,
        content: pageContents,
        reason: `Initialization completed!`,
    };
  

    if (wikiPage) {
        await context.reddit.updateWikiPage(wikiPageOptions);
    } else {
        await context.reddit.createWikiPage(wikiPageOptions);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: wikiPageName,
            listed: true,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
    console.log("Wiki page updated (first time).");

    const wikiPageName2 = "spotlight/logs";
      let wikiPage2: WikiPage | undefined;
    try {
        wikiPage2 = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

     var pageLog = `App installed on ${CurrentCESTDateTime()}.\n\n\n`;
      pageLog += `---\n\n`;

      const wikiPageOptions2 = {
        subredditName: subreddit.name,
        page: wikiPageName2,
        content: pageLog,
        reason: `App installed.`,
    };
  

    if (wikiPage2) {
        await context.reddit.updateWikiPage(wikiPageOptions2);
    } else {
        await context.reddit.createWikiPage(wikiPageOptions2);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: wikiPageName2,
            listed: true,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
    console.log("First log.");


    await context.reddit.modMail.createConversation({
      body: firstMsg,
      isAuthorHidden: false,
      subredditName: subreddit.name,
      subject: `Thanks for installing Spotlight!`,
      to: null,
    })
    console.log("First message sent!");

}
}
); 

Devvit.addTrigger({
  event: 'AppUpgrade',
  async onEvent(event, context) {
  
    console.log(`App updated on r/${event.subreddit?.name}`);

    const subreddit = await context.reddit.getCurrentSubreddit();

    var updateMsg = `Hello r/${subreddit.name} mods,\n\n`;

    updateMsg += `You're receiving this message because **Spotlight** has just been updated on r/${subreddit.name}.\n\n`;

    updateMsg += `**What's new?**\n\n`;
    updateMsg += `🔹 Spotlight app got featured in the latest [Snoosletter](https://redditforcommunity.com/blog/snoosletter-may-2025) as the Dev Platform App of the Month for May 2025 → huge thanks to everyone using it, testing it, and sending feedback :)\n\n`;
    updateMsg += `🔹 Fixed an issue where post flairs were being changed even when auto-flair was disabled → thanks to everyone who reported this!\n\n`;
    updateMsg += `🔹 Fixed some formatting glitches in app's comments\n\n`;
    
    updateMsg += `[Instructions](https://www.reddit.com/r/paskapps/comments/1f8cmde/introducing_spotlight_an_app_that_allows_op_and/) | [Logs](https://reddit.com/r/${subreddit.name}/w/spotlight/logs) | [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight%20Support)\n\n\n`;

    function CurrentCESTDateTime(): string {
      const cestTime = new Date(Date.now() + 2 * 60 * 60000); // CEST is UTC+2
      return cestTime.toISOString().slice(0, 19).replace('T', ' ') + ' CEST';
    }

    const wikiPageName = "spotlight";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

      var pageContents = `* [Instructions](https://www.reddit.com/r/paskapps/comments/1f8cmde/introducing_spotlight_an_app_that_allows_op_and/)\n\n`;
      pageContents += `* [Config](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)\n\n`;
      pageContents += `* [Logs](https://reddit.com/r/${subreddit.name}/w/spotlight/logs)\n\n`;
      pageContents += `* [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n`;
      pageContents += `---\n\n`;

      const wikiPageOptions = {
        subredditName: subreddit.name,
        page: wikiPageName,
        content: pageContents,
        reason: `Initialization completed!`,
    };
  

    if (wikiPage) {
        await context.reddit.updateWikiPage(wikiPageOptions);
    } else {
        await context.reddit.createWikiPage(wikiPageOptions);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: wikiPageName,
            listed: true,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
    console.log("Initialization page updated.");

    const wikiPageName2 = "spotlight/logs";
      let wikiPage2: WikiPage | undefined;
    try {
        wikiPage2 = await context.reddit.getWikiPage(subreddit.name, wikiPageName2);
    } catch {
        //
    }

    var pageLog = `${wikiPage2?.content}\n\n`;
      pageLog += `App updated on ${CurrentCESTDateTime()}.\n\n\n`;
      pageLog += `---\n\n`;

      const wikiPageOptions2 = {
        subredditName: subreddit.name,
        page: wikiPageName2,
        content: pageLog,
        reason: `App updated.`,
    };
  
//
    if (wikiPage2) {
        await context.reddit.updateWikiPage(wikiPageOptions2);
    } else {
        await context.reddit.createWikiPage(wikiPageOptions2);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: wikiPageName2,
            listed: true,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
    console.log("Update log.");

    await context.reddit.modMail.createConversation({
      body: updateMsg,
      isAuthorHidden: false,
      subredditName: subreddit.name,
      subject: `Spotlight update`,
      to: null,
    })
    console.log("Update message sent!");

}
}
); 

const pinThatCommentAsOP = Devvit.createForm(
    {
      title: 'Pin that comment (as OP)',
      fields: [
        {
          name: 'modNote',
          label: 'Note',
          helpText: 'Optional',
          type: 'string',
        },
      ],
    },
    async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const commentId = await context.commentId!;
    const OP = await context.reddit.getCurrentUser();
    const originalComment = (await context.reddit.getCommentById(commentId));
    const commentLink = (await context.reddit.getCommentById(commentId)).permalink;
    const commentText = (await context.reddit.getCommentById(commentId)).body?.split("\n\n").join("\n\n> ");
    const pinNote = _event.values.modNote;

    const setSpotlightPostFlair = await context?.settings.get('setFlair') as boolean;
    const spotlightFlairText = await context?.settings.get('spotlightPostFlairText') as string;

    const alertUser = await context?.settings.get('alertUser') as boolean;
    const sendModmail = await context?.settings.get('sendModmail') as boolean;        
    const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;        
    const autoLock = await context?.settings.get('autoLock') as boolean; 
    

    var messageText = `Hello u/${originalComment.authorName},\n\n`;

    messageText += `We would like to inform you that your [comment](https://reddit.com${commentLink}) has been pinned by OP (u/${OP?.username}).\n\n`;


    var notificationForMods = `**${OP?.username} (OP)** has pinned the [comment](https://reddit.com${commentLink}) by  u/${originalComment.authorName}.\n\n`;
      notificationForMods += `[Recent uses](https://reddit.com/r/${subreddit.name}/w/spotlight/logs) | [Config](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app) | [Feedback](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n`;
  

    if (!pinNote){
      
      var pinnedComment = `OP has pinned a [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}:\n\n`;
      pinnedComment += `> ${commentText}\n\n`;


    const newCom = await context.reddit.submitComment({
      id: originalComment.postId, 
      text: pinnedComment});

    messageText += `You can view pinned comment [here](${newCom.permalink}).\n\n`,
    messageText += `Thanks for contributing!\n\n`,
    messageText += `~ r/${subreddit.name} Mod Team\n\n`;

    
    newCom.distinguish(true);

    if (autoLock == true){
    newCom.lock();
    };
    submitPostReply
    if (!setSpotlightPostFlair){
      console.log("Auto changing the post flair is disabled, skipping...");
    } else {
      console.log("Auto changing the post flair is enabled, okay...");
      await context.reddit.setPostFlair({
        subredditName: subreddit.name, 
        postId: originalComment.postId, 
        text: spotlightFlairText, 
      });
    };
    ui.showToast(`Posted!`);

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: originalComment.authorName,
      label: 'HELPFUL_USER',
      note: `Comment pinned by ${OP?.username}.`,
      redditId: originalComment.postId
    });

    if (!alertUser){
      console.log('No alerting.')
    } else {
      console.log("Alerting user...");
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: originalComment.authorName,
        subject: `Your comment has been pinned by OP`,
        text: messageText
      })
    };

    if (!sendModmail){
      console.log('No mod-alerting.')
    } else {
      console.log("Alerting mods...");
      await context.reddit.modMail.createConversation({
        body: notificationForMods,
        isAuthorHidden: false,
        subredditName: subreddit.name,
        subject: `${OP?.username} has used Spotlight`,
        to: null,
      })
    };

    function CurrentCETDateTime(): string {
      const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
      return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
  }

    const wikiPageName = "spotlight/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

      var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `✅ ${CurrentCETDateTime()} - u/${OP?.username} (OP) successfully pinned a [comment](https://reddit.com${commentLink}) by u/${originalComment?.authorName}.\n\n`;
      pageContents += `**Content** ([link](${newCom.permalink})):\n\n`;
      pageContents += `> ${commentText}\n\n`;
      pageContents += `---\n\n`;

      const wikiPageOptions = {
        subredditName: subreddit.name,
        page: wikiPageName,
        content: pageContents,
        reason: "Logs updated",
    };
  

    if (wikiPage) {
        await context.reddit.updateWikiPage(wikiPageOptions);
    } else {
        await context.reddit.createWikiPage(wikiPageOptions);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: wikiPageName,
            listed: true,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
    console.log("Logs page edited.");

    const webhook = await context?.settings.get('webhook') as string;

    if (!webhook) {
      console.error('No webhook URL provided');
      return;
    }
    else {
    try {

      let payload;

      if (sendtoDiscord == false) {
        console.log("Not sending to Discord, skipping...");
      } else {

      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        discordAlertMessage = `**${OP?.username} (OP)** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}.\n\n`;
        
        if (discordRole) {
            discordAlertMessage += `<@&${discordRole}>`;
        } else {
           discordAlertMessage;
        };
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");

   
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
{
  title: `Pinned comment`,
  url: `https://reddit.com${newCom.permalink}`,
  fields: [
    {
      name: `Recent uses`,
      value: `[Link](https://reddit.com/r/${subreddit.name}/w/spotlight/logs)`,
      inline: true,
    },
    {
      name: 'Config',
      value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
      inline: true,
    },
    {
      name: 'Feedback',
      value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
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
    }}
    ui.showToast(`Posted!`);

  }
  else {
    var pinnedComment = `OP has pinned a [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}:\n\n`;
      pinnedComment += `> ${commentText}\n\n`;
      pinnedComment += `**Note from OP**: ${pinNote}\n\n`;


    const newCom = await context.reddit.submitComment({
      id: originalComment.postId, 
      text: pinnedComment });

      messageText += `You can view pinned comment [here](${newCom.permalink}).\n\n`,

      messageText += `Note from OP:\n\n`,
  
      messageText += `> ${pinNote}\n\n`,
      
      messageText += `Thanks for contributing!\n\n`,
  
      messageText += `~ r/${subreddit.name} Mod Team\n\n`;

    newCom.distinguish(true);
    if (autoLock == true){
      newCom.lock();
      };
      if (!setSpotlightPostFlair){
        console.log("Auto changing the post flair is disabled, skipping...");
      } else {
        console.log("Auto changing the post flair is enabled, okay...");
        await context.reddit.setPostFlair({
          subredditName: subreddit.name, 
          postId: originalComment.postId, 
          text: spotlightFlairText, 
        });
      };

      if (!alertUser){
        console.log('No alerting.')
      } else {
        console.log("Alerting user...");
        await context.reddit.sendPrivateMessageAsSubreddit({
          fromSubredditName: subreddit.name,
          to: originalComment.authorName,
          subject: `Your comment has been pinned by OP`,
          text: messageText
        })
      };

      await context.reddit.addModNote({
        subreddit: subreddit.name,
        user: originalComment.authorName,
        label: 'HELPFUL_USER',
        note: `Comment pinned by ${OP?.username}.`,
        redditId: originalComment.postId
      });

      if (!sendModmail){
        console.log('No mod-alerting.')
      } else {
        console.log("Alerting mods...");
        await context.reddit.modMail.createConversation({
          body: notificationForMods,
          isAuthorHidden: false,
          subredditName: subreddit.name,
          subject: `${OP?.username} has used Spotlight`,
          to: null,
        })
      };

      function CurrentCETDateTime(): string {
        const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
        return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
    }
  
      const wikiPageName = "spotlight/logs";
        let wikiPage: WikiPage | undefined;
      try {
          wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
      } catch {
          //
      }
  
        var pageContents = `${wikiPage?.content}\n\n`;
        pageContents += `✅ ${CurrentCETDateTime()} - u/${OP?.username} (OP) successfully pinned [this comment](https://reddit.com${commentLink}) by u/${originalComment?.authorName}.\n\n`;
        pageContents += `**Content** ([link](${newCom.permalink})):\n\n`;
        pageContents += `> ${commentText}\n\n`;
        pageContents += `**Note from OP**: ${pinNote}\n\n`;
        pageContents += `---\n\n`;
  
        const wikiPageOptions = {
          subredditName: subreddit.name,
          page: wikiPageName,
          content: pageContents,
          reason: "Logs updated",
      };
    
  
      if (wikiPage) {
          await context.reddit.updateWikiPage(wikiPageOptions);
      } else {
          await context.reddit.createWikiPage(wikiPageOptions);
          await context.reddit.updateWikiPageSettings({
              subredditName: subreddit.name,
              page: wikiPageName,
              listed: true,
              permLevel: WikiPagePermissionLevel.MODS_ONLY,
          });
      }
      console.log("Logs page edited.");

      const webhook = await context?.settings.get('webhook') as string;

    if (!webhook) {
      console.error('No webhook URL provided');
      return;
    }
    else {
    try {

      let payload;

      if (sendtoDiscord == false) {
        console.log("Not sending to Discord, skipping...");
      } else {

      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        discordAlertMessage = `**${OP?.username} (OP)** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}. **Note**: ${pinNote}\n\n`;
        
        if (discordRole) {
            discordAlertMessage += `<@&${discordRole}>`;
        } else {
           discordAlertMessage;
        };
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");

   
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
{
  title: `Pinned comment`,
  url: `https://reddit.com${newCom.permalink}`,
  fields: [
    {
      name: `Recent uses`,
      value: `[Link](https://reddit.com/r/${subreddit.name}/w/spotlight/logs)`,
      inline: true,
    },
    {
      name: 'Config',
      value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
      inline: true,
    },
    {
      name: 'Feedback',
      value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
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
    }}
    ui.showToast(`Posted!`);
  }});

const pinThatCommentAsTrustedUser = Devvit.createForm(
    {
      title: 'Pin that comment (as a trusted user)',
      fields: [
        {
          name: 'modNote',
          label: 'Note',
          helpText: 'Optional',
          type: 'string',
        },
        {
          name: 'usernameVisibility',
          label: 'Let others see that I pinned this',
          helpText: 'If unchecked, your username will not appear in the pinned message (only mods can see full details).',
          type: 'boolean',
        },
      ],
    },
    async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const commentId = await context.commentId!;
    const appUser = await context.reddit.getCurrentUser();
    const originalComment = (await context.reddit.getCommentById(commentId));
    const commentLink = (await context.reddit.getCommentById(commentId)).permalink;
    const commentText = (await context.reddit.getCommentById(commentId)).body?.split("\n\n").join("\n\n> ");
    const pinNote = _event.values.modNote;
    const usernameVisibility = _event.values.usernameVisibility;

    const setSpotlightPostFlair = await context?.settings.get('setFlair') as boolean;
    const spotlightFlairText = await context?.settings.get('spotlightPostFlairText') as string;

    const alertUser = await context?.settings.get('alertUser') as boolean;
    const sendModmail = await context?.settings.get('sendModmail') as boolean;        
    const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;        
    const autoLock = await context?.settings.get('autoLock') as boolean; 
    

    var messageText = `Hello u/${originalComment.authorName},\n\n`;

    if (usernameVisibility == true){
      messageText += `We would like to inform you that your [comment](https://reddit.com${commentLink}) has been pinned by u/${appUser?.username}.\n\n`;
    } else
    messageText += `We would like to inform you that your [comment](https://reddit.com${commentLink}) has been pinned by a trusted user.\n\n`;


    var notificationForMods = `**${appUser?.username}** has pinned the [comment](https://reddit.com${commentLink}) by  u/${originalComment.authorName}.\n\n`;
      notificationForMods += `[Recent uses](https://reddit.com/r/${subreddit.name}/w/spotlight/logs) | [Config](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app) | [Feedback](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n`;
  

    if (!pinNote){
      
      var pinnedComment = `Pinned [comment](https://reddit.com${commentLink}) from u/${originalComment.authorName}:\n\n`;
      pinnedComment += `> ${commentText}\n\n`;


    const newCom = await context.reddit.submitComment({
      id: originalComment.postId, 
      text: pinnedComment});

    messageText += `You can view pinned comment [here](${newCom.permalink}).\n\n`,
    messageText += `Thanks for contributing!\n\n`,
    messageText += `~ r/${subreddit.name} Mod Team\n\n`;

    
    newCom.distinguish(true);

    if (autoLock == true){
    newCom.lock();
    };
    submitPostReply
    if (!setSpotlightPostFlair){
      console.log("Auto changing the post flair is disabled, skipping...");
    } else {
      console.log("Auto changing the post flair is enabled, okay...");
      await context.reddit.setPostFlair({
        subredditName: subreddit.name, 
        postId: originalComment.postId, 
        text: spotlightFlairText, 
      });
    };
    ui.showToast(`Posted!`);

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: originalComment.authorName,
      label: 'HELPFUL_USER',
      note: `Comment pinned by ${appUser?.username}.`,
      redditId: originalComment.postId
    });

    if (!alertUser){
      console.log('No alerting.')
    } else {
      console.log("Alerting user...");
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: originalComment.authorName,
        subject: `Your comment has been pinned`,
        text: messageText
      })
    };

    if (!sendModmail){
      console.log('No mod-alerting.')
    } else {
      console.log("Alerting mods...");
      await context.reddit.modMail.createConversation({
        body: notificationForMods,
        isAuthorHidden: false,
        subredditName: subreddit.name,
        subject: `${appUser?.username} has used Spotlight`,
        to: null,
      })
    };

    function CurrentCETDateTime(): string {
      const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
      return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
  }

    const wikiPageName = "spotlight/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

      var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `✅ ${CurrentCETDateTime()} - u/${appUser?.username} successfully pinned [this comment](https://reddit.com${commentLink}) by u/${originalComment?.authorName}.\n\n`;
      pageContents += `**Content** ([link](${newCom.permalink})):\n\n`;
      pageContents += `> ${commentText}\n\n`;
      pageContents += `---\n\n`;

      const wikiPageOptions = {
        subredditName: subreddit.name,
        page: wikiPageName,
        content: pageContents,
        reason: "Logs updated",
    };
  

    if (wikiPage) {
        await context.reddit.updateWikiPage(wikiPageOptions);
    } else {
        await context.reddit.createWikiPage(wikiPageOptions);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: wikiPageName,
            listed: true,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
    console.log("Logs page edited.");

    const webhook = await context?.settings.get('webhook') as string;

    if (!webhook) {
      console.error('No webhook URL provided');
      return;
    }
    else {
    try {

      let payload;

      if (sendtoDiscord == false) {
        console.log("Not sending to Discord, skipping...");
      } else {

      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        discordAlertMessage = `**${appUser?.username}** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}.\n\n`;
        
        if (discordRole) {
            discordAlertMessage += `<@&${discordRole}>`;
        } else {
           discordAlertMessage;
        };
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");

   
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
{
  title: `Pinned comment`,
  url: `https://reddit.com${newCom.permalink}`,
  fields: [
    {
      name: `Recent uses`,
      value: `[Link](https://reddit.com/r/${subreddit.name}/w/spotlight/logs)`,
      inline: true,
    },
    {
      name: 'Config',
      value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
      inline: true,
    },
    {
      name: 'Feedback',
      value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
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
    }}
    ui.showToast(`Posted!`);

  }
  else {
    if (usernameVisibility == true){
    var pinnedComment = `u/${appUser?.username} has pinned [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}:\n\n`;
    pinnedComment += `> ${commentText}\n\n`;
    pinnedComment += `**Note:** ${pinNote}\n\n`;
  } else {
    var pinnedComment = `Pinned [comment](https://reddit.com${commentLink}) from u/${originalComment.authorName}:\n\n`;
      pinnedComment += `> ${commentText}\n\n`;
      pinnedComment += `**Note:** ${pinNote}\n\n`;
  }

    const newCom = await context.reddit.submitComment({
      id: originalComment.postId, 
      text: pinnedComment });

      messageText += `You can view pinned comment [here](${newCom.permalink}).\n\n`,

      messageText += `Note:\n\n`,
  
      messageText += `> ${pinNote}\n\n`,
      
      messageText += `Thanks for contributing!\n\n`,
  
      messageText += `~ r/${subreddit.name} Mod Team\n\n`;

    newCom.distinguish(true);
    if (autoLock == true){
      newCom.lock();
      };
      if (!setSpotlightPostFlair){
        console.log("Auto changing the post flair is disabled, skipping...");
      } else {
        console.log("Auto changing the post flair is enabled, okay...");
        await context.reddit.setPostFlair({
          subredditName: subreddit.name, 
          postId: originalComment.postId, 
          text: spotlightFlairText, 
        });
      };

      if (!alertUser){
        console.log('No alerting.')
      } else {
        console.log("Alerting user...");
        await context.reddit.sendPrivateMessageAsSubreddit({
          fromSubredditName: subreddit.name,
          to: originalComment.authorName,
          subject: `Your comment has been pinned`,
          text: messageText
        })
      };

      await context.reddit.addModNote({
        subreddit: subreddit.name,
        user: originalComment.authorName,
        label: 'HELPFUL_USER',
        note: `Comment pinned by ${appUser?.username}.`,
        redditId: originalComment.postId
      });

      if (!sendModmail){
        console.log('No mod-alerting.')
      } else {
        console.log("Alerting mods...");
        await context.reddit.modMail.createConversation({
          body: notificationForMods,
          isAuthorHidden: false,
          subredditName: subreddit.name,
          subject: `${appUser?.username} has used Spotlight`,
          to: null,
        })
      };

      function CurrentCETDateTime(): string {
        const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
        return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
    }
  
      const wikiPageName = "spotlight/logs";
        let wikiPage: WikiPage | undefined;
      try {
          wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
      } catch {
          //
      }
  
        var pageContents = `${wikiPage?.content}\n\n`;
        pageContents += `✅ ${CurrentCETDateTime()} - u/${appUser?.username} successfully pinned [this comment](https://reddit.com${commentLink}) by u/${originalComment?.authorName}.\n\n`;
        pageContents += `**Content** ([link](${newCom.permalink})):\n\n`;
        pageContents += `> ${commentText}\n\n`;
        pageContents += `**Note**: ${pinNote}\n\n`;
        pageContents += `---\n\n`;
  
        const wikiPageOptions = {
          subredditName: subreddit.name,
          page: wikiPageName,
          content: pageContents,
          reason: "Logs updated",
      };
    
  
      if (wikiPage) {
          await context.reddit.updateWikiPage(wikiPageOptions);
      } else {
          await context.reddit.createWikiPage(wikiPageOptions);
          await context.reddit.updateWikiPageSettings({
              subredditName: subreddit.name,
              page: wikiPageName,
              listed: true,
              permLevel: WikiPagePermissionLevel.MODS_ONLY,
          });
      }
      console.log("Logs page edited.");

      const webhook = await context?.settings.get('webhook') as string;

    if (!webhook) {
      console.error('No webhook URL provided');
      return;
    }
    else {
    try {

      let payload;

      if (sendtoDiscord == false) {
        console.log("Not sending to Discord, skipping...");
      } else {

      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        discordAlertMessage = `**${appUser?.username}** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}. **Note**: ${pinNote}\n\n`;
        
        if (discordRole) {
            discordAlertMessage += `<@&${discordRole}>`;
        } else {
           discordAlertMessage;
        };
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");

   
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
{
  title: `Pinned comment`,
  url: `https://reddit.com${newCom.permalink}`,
  fields: [
    {
      name: `Recent uses`,
      value: `[Link](https://reddit.com/r/${subreddit.name}/w/spotlight/logs)`,
      inline: true,
    },
    {
      name: 'Config',
      value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
      inline: true,
    },
    {
      name: 'Feedback',
      value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
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
    }}
    ui.showToast(`Posted!`);
}});

const pinThatCommentAsMod = Devvit.createForm(
    {
      title: 'Pin that comment',
      fields: [
        {
          name: 'modNote',
          label: 'Note',
          helpText: 'Optional',
          type: 'string',
        },
      ],
    },
    async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const commentId = await context.commentId!;
    const modName = await context.reddit.getCurrentUser();
    const originalComment = (await context.reddit.getCommentById(commentId));
    const commentLink = (await context.reddit.getCommentById(commentId)).permalink;
    const commentText = (await context.reddit.getCommentById(commentId)).body?.split("\n\n").join("\n\n> ");
    const pinNote = _event.values.modNote;

    const setSpotlightPostFlair = await context?.settings.get('setFlair') as boolean;
    const spotlightFlairText = await context?.settings.get('spotlightPostFlairText') as string;

    const alertUser = await context?.settings.get('alertUser') as boolean;
    const sendModmail = await context?.settings.get('sendModmail') as boolean;        
    const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;        
    const autoLock = await context?.settings.get('autoLock') as boolean; 
    

    var messageText = `Hello u/${originalComment.authorName},\n\n`;

    messageText += `We would like to inform you that your [comment](https://reddit.com${commentLink}) has been pinned by moderators.\n\n`;


    var notificationForMods = `**${modName?.username}** has pinned the [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}.\n\n`;
      notificationForMods += `[Recent uses](https://reddit.com/r/${subreddit.name}/w/spotlight/logs) | [Config](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app) | [Feedback](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n`;
  

    if (!pinNote){
      
      var pinnedComment = `Mods have pinned a [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}:\n\n`;
      pinnedComment += `> ${commentText}\n\n`;


    const newCom = await context.reddit.submitComment({
      id: originalComment.postId, 
      text: pinnedComment});

    messageText += `You can view a pinned comment [here](${newCom.permalink}).\n\n`,
    messageText += `Thanks for contributing!\n\n`,
    messageText += `~ r/${subreddit.name} Mod Team\n\n`;

    
    newCom.distinguish(true);

    if (autoLock == true){
    newCom.lock();
    };
    submitPostReply
    if (!setSpotlightPostFlair){
      console.log("Auto changing the post flair is disabled, skipping...");
    } else {
      console.log("Auto changing the post flair is enabled, okay...");
      await context.reddit.setPostFlair({
        subredditName: subreddit.name, 
        postId: originalComment.postId, 
        text: spotlightFlairText, 
      });
    };
    ui.showToast(`Posted!`);

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: originalComment.authorName,
      label: 'HELPFUL_USER',
      note: `Comment pinned by ${modName?.username} (mod).`,
      redditId: originalComment.postId
    });

    if (!alertUser){
      console.log('No alerting.')
    } else {
      console.log("Alerting user...");
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: originalComment.authorName,
        subject: `Your comment has been pinned by mods`,
        text: messageText
      })
    };

    if (!sendModmail){
      console.log('No mod-alerting.')
    } else {
      console.log("Alerting mods...");
      await context.reddit.modMail.createConversation({
        body: notificationForMods,
        isAuthorHidden: false,
        subredditName: subreddit.name,
        subject: `${modName?.username} has used Spotlight`,
        to: null,
      })
    };

    function CurrentCETDateTime(): string {
      const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
      return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
  }

    const wikiPageName = "spotlight/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

      var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `✅ ${CurrentCETDateTime()} - u/${modName?.username} (mod) successfully pinned [this comment](https://reddit.com${commentLink}) by u/${originalComment?.authorName}.\n\n`;
      pageContents += `**Content** ([link](${newCom.permalink})):\n\n`;
      pageContents += `> ${commentText}\n\n`;
      pageContents += `---\n\n`;

      const wikiPageOptions = {
        subredditName: subreddit.name,
        page: wikiPageName,
        content: pageContents,
        reason: "Logs updated",
    };
  

    if (wikiPage) {
        await context.reddit.updateWikiPage(wikiPageOptions);
    } else {
        await context.reddit.createWikiPage(wikiPageOptions);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: wikiPageName,
            listed: true,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
    console.log("Logs page edited.");

    const webhook = await context?.settings.get('webhook') as string;

    if (!webhook) {
      console.error('No webhook URL provided');
      return;
    }
    else {
    try {

      let payload;

      if (sendtoDiscord == false) {
        console.log("Not sending to Discord, skipping...");
      } else {

      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        discordAlertMessage = `**${modName?.username} (mod)** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}.\n\n`;
        
        if (discordRole) {
            discordAlertMessage += `<@&${discordRole}>`;
        } else {
           discordAlertMessage;
        };
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");

   
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
{
  title: `Pinned comment`,
  url: `https://reddit.com${newCom.permalink}`,
  fields: [
    {
      name: `Recent uses`,
      value: `[Link](https://reddit.com/r/${subreddit.name}/w/spotlight/logs)`,
      inline: true,
    },
    {
      name: 'Config',
      value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
      inline: true,
    },
    {
      name: 'Feedback',
      value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
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
    }}
    ui.showToast(`Posted!`);

  }
  else {
    var pinnedComment = `Mods have pinned a [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}:\n\n`;
      pinnedComment += `> ${commentText}\n\n`;
      pinnedComment += `**Note:** ${pinNote}\n\n`;


    const newCom = await context.reddit.submitComment({
      id: originalComment.postId, 
      text: pinnedComment });

      messageText += `You can view pinned comment [here](${newCom.permalink}).\n\n`,

      messageText += `Note from mods:\n\n`,
  
      messageText += `> ${pinNote}\n\n`,
      
      messageText += `Thanks for contributing!\n\n`,
  
      messageText += `~ r/${subreddit.name} Mod Team\n\n`;

    newCom.distinguish(true);
    if (autoLock == true){
      newCom.lock();
      };
      if (!setSpotlightPostFlair){
        console.log("Auto changing the post flair is disabled, skipping...");
      } else {
        console.log("Auto changing the post flair is enabled, okay...");
        await context.reddit.setPostFlair({
          subredditName: subreddit.name, 
          postId: originalComment.postId, 
          text: spotlightFlairText, 
        });
      };

      if (!alertUser){
        console.log('No alerting.')
      } else {
        console.log("Alerting user...");
        await context.reddit.sendPrivateMessageAsSubreddit({
          fromSubredditName: subreddit.name,
          to: originalComment.authorName,
          subject: `Your comment has been pinned by mods`,
          text: messageText
        })
      };

      await context.reddit.addModNote({
        subreddit: subreddit.name,
        user: originalComment.authorName,
        label: 'HELPFUL_USER',
        note: `Comment pinned by ${modName?.username} (mod).`,
        redditId: originalComment.postId
      });

      if (!sendModmail){
        console.log('No mod-alerting.')
      } else {
        console.log("Alerting mods...");
        await context.reddit.modMail.createConversation({
          body: notificationForMods,
          isAuthorHidden: false,
          subredditName: subreddit.name,
          subject: `${modName?.username} has used Spotlight`,
          to: null,
        })
      };

      function CurrentCETDateTime(): string {
        const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
        return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
    }
  
      const wikiPageName = "spotlight/logs";
        let wikiPage: WikiPage | undefined;
      try {
          wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
      } catch {
          //
      }
  
        var pageContents = `${wikiPage?.content}\n\n`;
        pageContents += `✅ ${CurrentCETDateTime()} - u/${modName?.username} (mod) successfully pinned [this comment](https://reddit.com${commentLink}) by u/${originalComment?.authorName}.\n\n`;
        pageContents += `**Content** ([link](${newCom.permalink})):\n\n`;
        pageContents += `> ${commentText}\n\n`;
        pageContents += `**Note**: ${pinNote}\n\n`;
        pageContents += `---\n\n`;
  
        const wikiPageOptions = {
          subredditName: subreddit.name,
          page: wikiPageName,
          content: pageContents,
          reason: "Logs updated",
      };
    
  
      if (wikiPage) {
          await context.reddit.updateWikiPage(wikiPageOptions);
      } else {
          await context.reddit.createWikiPage(wikiPageOptions);
          await context.reddit.updateWikiPageSettings({
              subredditName: subreddit.name,
              page: wikiPageName,
              listed: true,
              permLevel: WikiPagePermissionLevel.MODS_ONLY,
          });
      }
      console.log("Logs page edited.");

      const webhook = await context?.settings.get('webhook') as string;

    if (!webhook) {
      console.error('No webhook URL provided');
      return;
    }
    else {
    try {

      let payload;

      if (sendtoDiscord == false) {
        console.log("Not sending to Discord, skipping...");
      } else {

      const discordRole = await context.settings.get('discordRole');

        let discordAlertMessage;
        discordAlertMessage = `**${modName?.username} (mod)** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}. **Note**: ${pinNote}\n\n`;
        
        if (discordRole) {
            discordAlertMessage += `<@&${discordRole}>`;
        } else {
           discordAlertMessage;
        };
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");

   
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
{
  title: `Pinned comment`,
  url: `https://reddit.com${newCom.permalink}`,
  fields: [
    {
      name: `Recent uses`,
      value: `[Link](https://reddit.com/r/${subreddit.name}/w/spotlight/logs)`,
      inline: true,
    },
    {
      name: 'Config',
      value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
      inline: true,
    },
    {
      name: 'Feedback',
      value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
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
    }}
    ui.showToast(`Posted!`);
}});

Devvit.addMenuItem({
  location: ['comment'],
  forUserType: 'moderator',
  label: '[Spotlight] - Delete content',
  description: 'Delete content created by Spotlight',
  onPress: async (event, context) => {
    const { reddit, ui } = context;
    const { location } = event;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const appUser = context.reddit.getAppUser();
    const currentUser = await context.reddit.getCurrentUser();
    const perms = await currentUser?.getModPermissionsForSubreddit(subreddit.name);
    const commentId = context.commentId!;
    const modName = await context.reddit.getCurrentUser();
    const spotlightComment = (await context.reddit.getCommentById(commentId));

    function CurrentCETDateTime(): string {
      const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
      return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
  }

    const wikiPageName = "spotlight/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }


    if (perms?.includes('posts') || perms?.includes('all')){
  
    if ((await context.reddit.getCommentById(context.commentId!)).authorName == (await appUser).username)
    {
      spotlightComment.delete(); 
      console.log(`Spotlight content deleted by ${currentUser?.username}.`); 
      return ui.showToast('Deleted!');

  }
    else {
      ui.showToast(`This is only for content removal by ${(await appUser).username}!`);
    };
  } else {
    ui.showToast(`You don't have the necessary permissions.`);
  };
},
  });

Devvit.addTrigger({
  event: 'ModMail',
  async onEvent(event, context) {
  
    const autoArchiving = await context.settings.get<boolean>(('autoArchive'));

    if (!autoArchiving){
      console.log("Subreddit has disabled auto-archiving app messages.");
    }
    else {
      console.log("Subreddit has enabled (default setting) auto-archiving app messages.");
    try {
    if (event.messageAuthor?.name.includes('spotlight-app')) {
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
}
);

export default Devvit;
