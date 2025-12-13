import { Devvit, WikiPage, WikiPagePermissionLevel } from "@devvit/public-api";
import { submitPostReply } from "devvit-helpers";
import {
  WHAT_IS_SPOTLIGHT,
  PinnedCommentQuote,

  OP_PinnedComment,
  OP_PinnedComment_WithNote,

  TU_PinnedComment,
  TU_PinnedComment_Public,
  TU_PinnedComment_WithNote,

  Mod_PinnedComment,
  Mod_PinnedComment_WithNote,

  NotifyUser_OP,
  NotifyUser_OP_WithNote,
  NotifyUser_TU_Visible,
  NotifyUser_TU_Visible_WithNote,
  NotifyUser_TU_Anonymous,
  NotifyUser_TU_Anonymous_WithNote,
  NotifyUser_Mod,
  NotifyUser_Mod_WithNote,

  ModmailNotice,
  DiscordMessage,

  InstallMessage,
  UpdateMessage
} from './messages.js';

import {
  pinThatCommentAsOP,
  pinThatCommentAsTrustedUser,
  pinThatCommentAsMod
} from "./forms.js";

Devvit.configure({
  redditAPI: true, // Enable access to Reddit API
  http: true,
});

export enum SettingName {
  TrustedUsers = "trustedUsers",
}

Devvit.addSettings([
  {
    name: SettingName.TrustedUsers,
    type: "string",
    label: "List of trusted users who can use the app",
  },
  {
    name: "OPoption",
    type: "boolean",
    label: "Allow OP to pin the comment?",
    defaultValue: false,
  },
  {
    name: "autoLock",
    type: "boolean",
    label: "Auto-lock app comments",
    defaultValue: true,
  },
  {
    type: "boolean",
    name: "sendModmail",
    label: "Send to Modmail?",
    helpText: `Choose this if you'd like to receive notification for mod pinnings in Modmail.`,
    defaultValue: false,
  },
  {
    type: "group",
    label: "Discord",
    helpText: "Notify moderators on the Discord server.",
    fields: [
      {
        type: "boolean",
        name: "sendDiscord",
        label: "Send to Discord?",
        helpText: `Choose this if you'd like to receive notification for mod pinnings on the Discord server.`,
      },
      {
        type: "string",
        name: "webhook",
        label: "Webhook URL",
      },
      {
        type: "string",
        name: "discordRole",
        label: "Role ID to ping",
      },
    ],
  },
  {
    type: "group",
    label: "Notification",
    helpText: "Notify user about pinning the comment.",
    fields: [
      {
        name: "alertUser",
        type: "boolean",
        label: "Send a notification to user for pinning the comment",
        defaultValue: false,
      },
      {
        type: "boolean",
        name: "autoArchive",
        label: "Auto-archive app messages?",
        helpText: `If true, app will automatically archive app-messages. `,
        defaultValue: true,
      },
    ],
  },
  {
    type: "group",
    label: "Pinned Post Flair",
    helpText: "Automatically update flair when a comment is spotlighted",
    fields: [
      {
        name: "setFlair",
        type: "boolean",
        label: "Enable auto-flair on pin?",
        defaultValue: false,
      },
      {
        type: "string",
        name: "spotlightPostFlairText",
        label: "Flair label to apply",
        defaultValue: `Context Provided - Spotlight`,
      },
    ],
  },
]);

Devvit.addMenuItem({
  location: "comment",
  label: "Spotlight",
  description: "Pin this comment",
  onPress: async (_event, context) => {
    const { ui } = context;

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();
    const appUser = await context.reddit.getCurrentUser();
    const commentId = await context.commentId!;
    const modName = await context.reddit.getCurrentUser();
    const originalComment = await context.reddit.getCommentById(commentId);
    const postID = originalComment.postId;
    const post = context.reddit.getPostById(postID);
    const commentLink = (await context.reddit.getCommentById(commentId))
      .permalink;
    const perms = await currentUser?.getModPermissionsForSubreddit(
      subreddit.name,
    );
    const originalPoster = (await post).authorName;
    const OPoption = await context.settings.get<boolean>("OPoption");

    const spotlighter = await context.reddit.getCurrentUser();

    if (!spotlighter) {
      return ui.showToast("Spotlighter not found!");
    }

    const settings = await context.settings.getAll();
    const trustedUserSetting =
      (settings[SettingName.TrustedUsers] as string) ?? "";
    const trustedUsers = trustedUserSetting
      .split(",")
      .map((user) => user.trim().toLowerCase());

    const isTrustedUser = trustedUsers.includes(
      spotlighter?.username.toLowerCase(),
    );
    const isModWithPerms = perms?.includes("posts") || perms?.includes("all");
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
      console.log(
        `${spotlighter?.username} is a moderator with sufficient permissions.`,
      );
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
      return cetTime.toISOString().slice(0, 19).replace("T", " ") + " CET";
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
  },
});

Devvit.addTrigger({
  event: "AppInstall",
  async onEvent(event, context) {
    console.log(`App installed on r/${event.subreddit?.name}.`);

    const subreddit = await context.reddit.getCurrentSubreddit();
    const appAccount = await context.reddit.getAppUser();

    await context.reddit.setUserFlair({
      subredditName: subreddit.name,
      username: appAccount.username,
      text: "Mod Bot 🤖",
      textColor: "light",
      backgroundColor: "rgba(255, 0, 0, 1)",
    });

    const firstMsg = InstallMessage(subreddit.name);

    function CurrentCESTDateTime(): string {
      const cestTime = new Date(Date.now() + 2 * 60 * 60000); // CEST is UTC+2
      return cestTime.toISOString().slice(0, 19).replace("T", " ") + " CEST";
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
      wikiPage2 = await context.reddit.getWikiPage(
        subreddit.name,
        wikiPageName,
      );
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

    await context.reddit.modMail.createModNotification({
      bodyMarkdown: firstMsg,
      subredditId: subreddit.id,
      subject: `Thanks for installing Spotlight!`,
    });
    console.log("First message sent!");
  },
});

Devvit.addTrigger({
  event: "AppUpgrade",
  async onEvent(event, context) {
    console.log(`App updated on r/${event.subreddit?.name}`);

    const subreddit = await context.reddit.getCurrentSubreddit();

    const appAccount = await context.reddit.getAppUser();

    await context.reddit.setUserFlair({
      subredditName: subreddit.name,
      username: appAccount.username,
      text: "Mod Bot 🤖",
      textColor: "light",
      backgroundColor: "#FF0000",
    });

    const updateMsg = UpdateMessage(subreddit.name);

    function CurrentCESTDateTime(): string {
      const cestTime = new Date(Date.now() + 2 * 60 * 60000); // CEST is UTC+2
      return cestTime.toISOString().slice(0, 19).replace("T", " ") + " CEST";
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
      wikiPage2 = await context.reddit.getWikiPage(
        subreddit.name,
        wikiPageName2,
      );
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

    await context.reddit.modMail.createModNotification({
      bodyMarkdown: updateMsg,
      subredditId: subreddit.id,
      subject: `Spotlight update`,
    });
    console.log("Update message sent!");
  },
});

Devvit.addMenuItem({
  location: ["comment"],
  forUserType: "moderator",
  label: "[Spotlight] - Delete content",
  description: "Delete content created by Spotlight",
  onPress: async (event, context) => {
    const { reddit, ui } = context;
    const { location } = event;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const appUser = context.reddit.getAppUser();
    const currentUser = await context.reddit.getCurrentUser();
    const perms = await currentUser?.getModPermissionsForSubreddit(
      subreddit.name,
    );
    const commentId = context.commentId!;
    const modName = await context.reddit.getCurrentUser();
    const spotlightComment = await context.reddit.getCommentById(commentId);

    function CurrentCETDateTime(): string {
      const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
      return cetTime.toISOString().slice(0, 19).replace("T", " ") + " CET";
    }

    const wikiPageName = "spotlight/logs";
    let wikiPage: WikiPage | undefined;
    try {
      wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
      //
    }

    if (perms?.includes("posts") || perms?.includes("all")) {
      if (
        (await context.reddit.getCommentById(context.commentId!)).authorName ==
        (await appUser).username
      ) {
        spotlightComment.delete();
        console.log(`Spotlight content deleted by ${currentUser?.username}.`);
        return ui.showToast("Deleted!");
      } else {
        ui.showToast(
          `This is only for content removal by ${(await appUser).username}!`,
        );
      }
    } else {
      ui.showToast(`You don't have the necessary permissions.`);
    }
  },
});

export default Devvit;