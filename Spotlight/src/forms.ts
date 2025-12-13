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

export const pinThatCommentAsOP = Devvit.createForm(
  {
    title: "Pin that comment (as OP)",
    fields: [
      {
        name: "modNote",
        label: "Note",
        helpText: "Optional",
        type: "string",
      },
    ],
  },
  async (_event, context) => {
        const { reddit, ui } = context;
        const subreddit = await context.reddit.getCurrentSubreddit();
        const commentId = await context.commentId!;
        const OP = await context.reddit.getCurrentUser();
        const originalComment = await context.reddit.getCommentById(commentId);
        const commentLink = (await context.reddit.getCommentById(commentId))
          .permalink;
        const commentText = (await context.reddit.getCommentById(commentId)).body
          ?.split("\n\n")
          .join("\n\n> ");
        const pinNote = _event.values.modNote;
    
        const autoArchiving = await context.settings.get<boolean>("autoArchive");
    
        const setSpotlightPostFlair = (await context?.settings.get(
          "setFlair",
        )) as boolean;
        const spotlightFlairText = (await context?.settings.get(
          "spotlightPostFlairText",
        )) as string;
    
        const alertUser = (await context?.settings.get("alertUser")) as boolean;
        const sendModmail = (await context?.settings.get("sendModmail")) as boolean;
        const sendtoDiscord = (await context?.settings.get(
          "sendDiscord",
        )) as boolean;
        const autoLock = (await context?.settings.get("autoLock")) as boolean;
    
    
    
        var notificationForMods = `**${OP?.username} (OP)** has pinned the [comment](https://reddit.com${commentLink}) by  u/${originalComment.authorName}.\n\n`;
        notificationForMods += `[Recent uses](https://reddit.com/r/${subreddit.name}/w/spotlight/logs) | [Config](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app) | [Feedback](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n`;
    
        if (!pinNote) {
    
          const pinnedComment = OP_PinnedComment(
            originalComment.authorName,
            commentLink,
            commentText
          );
    
          
          const newCom = await context.reddit.submitComment({
            id: originalComment.postId,
            text: pinnedComment,
          });
    
          newCom.distinguish(true);
    
          if (autoLock == true) {
            newCom.lock();
          }
          submitPostReply;
    
          if (!setSpotlightPostFlair){
          console.log("Skipped setting post flair..")
        } else {
          console.log("Setting post flair...");
          const postFlair = await context.reddit.setPostFlair({
            subredditName: subreddit.name,
            postId: originalComment.postId,
            text: spotlightFlairText,
          });
        };
          ui.showToast(`Posted!`);
    
          await context.reddit.addModNote({
            subreddit: subreddit.name,
            user: originalComment.authorName,
            label: "HELPFUL_USER",
            note: `Comment pinned by ${OP?.username}.`,
            redditId: originalComment.postId,
          });
    
          let messageText = NotifyUser_OP(
          originalComment.authorName,
          commentLink,
          OP!.username!
        );
    
        messageText += `You can view pinned comment [here](${newCom.permalink}).\n\n`;
        messageText += `Thanks for contributing!\n\n~ r/${subreddit.name} Mod Team\n\n`;
    
          if (!alertUser) {
            console.log("No alerting.");
          } else {
            console.log("Alerting user...");
            const messageToUser = await context.reddit.modMail.createConversation({
              subredditName: subreddit.name,
              to: originalComment.authorName,
              isAuthorHidden: true,
              subject: `Your comment has been pinned by OP`,
              body: messageText,
            });
    
          await context.reddit.modMail.archiveConversation(messageToUser.conversation.id!);
          }
    
          if (!sendModmail) {
            console.log("No mod-alerting.");
          } else {
            console.log("Alerting mods...");
            const appNotification = await context.reddit.modMail.createModNotification({
              bodyMarkdown: notificationForMods,
              subject: `${OP?.username} has used Spotlight`,
              subredditId: subreddit.id,
            });
    
            if (!autoArchiving) {
              console.log("Subreddit has disabled auto-archiving app notifications.");
            } else {
              console.log("Subreddit has enabled auto-archiving app notifications..");
              await context.reddit.modMail.archiveConversation(appNotification);
              console.log("App notification archived!");
            }
          }
    
          function CurrentCETDateTime(): string {
            const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
            return cetTime.toISOString().slice(0, 19).replace("T", " ") + " CET";
          }
    
          const wikiPageName = "spotlight/logs";
          let wikiPage: WikiPage | undefined;
          try {
            wikiPage = await context.reddit.getWikiPage(
              subreddit.name,
              wikiPageName,
            );
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
    
          const webhook = (await context?.settings.get("webhook")) as string;
    
          if (!webhook) {
            console.error("No webhook URL provided");
            return;
          } else {
            try {
              let payload;
    
              if (sendtoDiscord == false) {
                console.log("Not sending to Discord, skipping...");
              } else {
                const discordRole = await context.settings.get("discordRole");
    
                let discordAlertMessage;
                discordAlertMessage = `**${OP?.username} (OP)** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}.\n\n`;
    
                if (discordRole) {
                  discordAlertMessage += `<@&${discordRole}>`;
                } else {
                  discordAlertMessage;
                }
    
                if (webhook.startsWith("https://discord.com/api/webhooks/")) {
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
                            name: "Config",
                            value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
                            inline: true,
                          },
                          {
                            name: "Feedback",
                            value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
                            inline: true,
                          },
                        ],
                      },
                    ],
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
                } catch (err) {
                  console.error(`Error sending alert: ${err}`);
                }
              }
            } catch (err) {
              console.error(`Error sending alert: ${err}`);
            }
          }
          ui.showToast(`Posted!`);
        } else {
          const pinnedComment = OP_PinnedComment_WithNote(
            originalComment.authorName,
            commentLink,
            commentText,
            pinNote
    );
    
    
          const newCom = await context.reddit.submitComment({
            id: originalComment.postId,
            text: pinnedComment,
          });
    
          let messageText = NotifyUser_OP_WithNote(
            originalComment.authorName,
            commentLink,
            OP!.username,
            pinNote
          );
          messageText += `You can view pinned comment [here](${newCom.permalink}).\n\n`;
          messageText += `Thanks for contributing!\n\n~ r/${subreddit.name} Mod Team\n\n`;
    
    
    
          newCom.distinguish(true);
          if (autoLock == true) {
            newCom.lock();
          }
    
          if (!alertUser) {
            console.log("No alerting.");
          } else {
            console.log("Alerting user...");
            const messageToUser = await context.reddit.modMail.createConversation({
              subredditName: subreddit.name,
              to: originalComment.authorName,
              isAuthorHidden: true,
              subject: `Your comment has been pinned by OP`,
              body: messageText,
            });
          await context.reddit.modMail.archiveConversation(messageToUser.conversation.id!);
          }
    
          await context.reddit.addModNote({
            subreddit: subreddit.name,
            user: originalComment.authorName,
            label: "HELPFUL_USER",
            note: `Comment pinned by ${OP?.username}.`,
            redditId: originalComment.postId,
          });
    
          if (!sendModmail) {
            console.log("No mod-alerting.");
          } else {
            console.log("Alerting mods...");
            const appNotification = await context.reddit.modMail.createModNotification({
              bodyMarkdown: notificationForMods,
              subredditId: subreddit.id,
              subject: `${OP?.username} has used Spotlight`,
            });
    
            if (!autoArchiving) {
              console.log("Subreddit has disabled auto-archiving app notifications.");
            } else {
              console.log("Subreddit has enabled auto-archiving app notifications..");
              await context.reddit.modMail.archiveConversation(appNotification);
              console.log("App notification archived!");
            }
          }
    
          function CurrentCETDateTime(): string {
            const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
            return cetTime.toISOString().slice(0, 19).replace("T", " ") + " CET";
          }
    
          const wikiPageName = "spotlight/logs";
          let wikiPage: WikiPage | undefined;
          try {
            wikiPage = await context.reddit.getWikiPage(
              subreddit.name,
              wikiPageName,
            );
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
    
          const webhook = (await context?.settings.get("webhook")) as string;
    
          if (!webhook) {
            console.error("No webhook URL provided");
            return;
          } else {
            try {
              let payload;
    
              if (sendtoDiscord == false) {
                console.log("Not sending to Discord, skipping...");
              } else {
                const discordRole = await context.settings.get("discordRole");
    
                let discordAlertMessage;
                discordAlertMessage = `**${OP?.username} (OP)** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}. **Note**: ${pinNote}\n\n`;
    
                if (discordRole) {
                  discordAlertMessage += `<@&${discordRole}>`;
                } else {
                  discordAlertMessage;
                }
    
                if (webhook.startsWith("https://discord.com/api/webhooks/")) {
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
                            name: "Config",
                            value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
                            inline: true,
                          },
                          {
                            name: "Feedback",
                            value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
                            inline: true,
                          },
                        ],
                      },
                    ],
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
                } catch (err) {
                  console.error(`Error sending alert: ${err}`);
                }
              }
            } catch (err) {
              console.error(`Error sending alert: ${err}`);
            }
          }
          ui.showToast(`Posted!`);
        }
    }
);

export const pinThatCommentAsTrustedUser = Devvit.createForm(
  {
    title: "Pin that comment (as a trusted user)",
    fields: [
      {
        name: "modNote",
        label: "Note",
        helpText: "Optional",
        type: "string",
      },
      {
        name: "usernameVisibility",
        label: "Let others see that I pinned this",
        helpText:
          "If unchecked, your username will not appear in the pinned message (only mods can see full details).",
        type: "boolean",
      },
    ],
  },
  async (_event, context) => {
    const { reddit, ui } = context;

    const subreddit = await reddit.getCurrentSubreddit();
    const commentId = context.commentId!;
    const appUser = await reddit.getCurrentUser();
    const originalComment = await reddit.getCommentById(commentId);

    const commentLink = originalComment.permalink;
    const commentText = originalComment.body?.split("\n\n").join("\n\n> ");

    const pinNote = _event.values.modNote;
    const usernameVisibility = _event.values.usernameVisibility;

    const isSelfPin = originalComment.authorName === appUser?.username;

    const autoArchiving = await context.settings.get<boolean>("autoArchive");
    const setSpotlightPostFlair = await context.settings.get<boolean>("setFlair");
    const spotlightFlairText = await context.settings.get<string>("spotlightPostFlairText");
    const alertUser = await context.settings.get("alertUser");
    const sendModmail = await context.settings.get("sendModmail");
    const sendtoDiscord = await context.settings.get("sendDiscord");
    const autoLock = await context.settings.get("autoLock");

    if (!setSpotlightPostFlair){
        console.log("Skipped setting post flair..")
    } else {
        console.log("Setting post flair...");
        await context.reddit.setPostFlair({
        subredditName: subreddit.name,
        postId: originalComment.postId,
        text: spotlightFlairText,
    });
}

    // ---------------------------------------------------------
    // BUILD TRUSTED USER → USER MESSAGE (4 CASES)
    // ---------------------------------------------------------
    let messageText = "";

    if (usernameVisibility) {
      if (!pinNote) {
        messageText = NotifyUser_TU_Visible(
          originalComment.authorName,
          commentLink,
          appUser!.username
        );
      } else {
        messageText = NotifyUser_TU_Visible_WithNote(
          originalComment.authorName,
          commentLink,
          appUser!.username,
          pinNote
        );
      }
    } else {
      if (!pinNote) {
        messageText = NotifyUser_TU_Anonymous(
          originalComment.authorName,
          commentLink
        );
      } else {
        messageText = NotifyUser_TU_Anonymous_WithNote(
          originalComment.authorName,
          commentLink,
          pinNote
        );
      }
    }

    // ---------------------------------------------------------
    // NOTICE FOR MODS
    // ---------------------------------------------------------
    let notificationForMods =
      `**${appUser?.username}** has pinned the ` +
      `[comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}.\n\n` +
      `[Recent uses](https://reddit.com/r/${subreddit.name}/w/spotlight/logs) | ` +
      `[Config](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app) | ` +
      `[Feedback](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n`;


    // =========================================================
    // CASE A — NO NOTE
    // =========================================================
    if (!pinNote) {
      let pinnedComment = "";

      if (usernameVisibility) {
        // SELF-PIN SPECIAL TEXT
        if (isSelfPin) {
          pinnedComment += `u/${appUser?.username} has pinned their own [comment](https://reddit.com${commentLink}):\n\n`;
        } else {
          pinnedComment += `u/${appUser?.username} has pinned a [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}:\n\n`;
        }
      } else {
        // anonymous mode — never reveal self-pin
        pinnedComment += `Pinned [comment](https://reddit.com${commentLink}) from u/${originalComment.authorName}:\n\n`;
      }

      pinnedComment += `> ${commentText}\n\n`;
      pinnedComment += `^([What is Spotlight?](https://developers.reddit.com/apps/spotlight-app))\n\n`;

      const newCom = await reddit.submitComment({
        id: originalComment.postId,
        text: pinnedComment,
      });

      messageText +=
        `You can view pinned comment [here](${newCom.permalink}).\n\n` +
        `Thanks for contributing!\n\n~ r/${subreddit.name} Mod Team\n\n`;

      newCom.distinguish(true);
      if (autoLock) newCom.lock();

      ui.showToast(`Posted!`);

      await reddit.addModNote({
        subreddit: subreddit.name,
        user: originalComment.authorName,
        label: "HELPFUL_USER",
        note: `Comment pinned by ${appUser?.username}.`,
        redditId: originalComment.postId,
      });

      // USER MESSAGE
      if (alertUser) {
        const mm = await reddit.modMail.createConversation({
          subredditName: subreddit.name,
          to: originalComment.authorName,
          isAuthorHidden: true,
          subject: `Your comment has been pinned`,
          body: messageText,
        });
        await reddit.modMail.archiveConversation(mm.conversation.id!);
      }

      // MOD MESSAGE
      if (sendModmail) {
        const notif = await reddit.modMail.createModNotification({
          bodyMarkdown: notificationForMods,
          subject: `${appUser?.username} has used Spotlight`,
          subredditId: subreddit.id,
        });

        if (autoArchiving) {
          await reddit.modMail.archiveConversation(notif);
        }
      }

      return;
    }

    // =========================================================
    // CASE B — WITH NOTE
    // =========================================================
    let pinnedComment = "";

    if (usernameVisibility) {
      if (isSelfPin) {
        pinnedComment += `u/${appUser?.username} has pinned their own [comment](https://reddit.com${commentLink}):\n\n`;
      } else {
        pinnedComment += `u/${appUser?.username} has pinned a [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}:\n\n`;
      }
    } else {
      pinnedComment += `Pinned [comment](https://reddit.com${commentLink}) from u/${originalComment.authorName}:\n\n`;
    }

    pinnedComment += `> ${commentText}\n\n`;
    pinnedComment += `**Note:** ${pinNote}\n\n`;
    pinnedComment += `^([What is Spotlight?](https://developers.reddit.com/apps/spotlight-app))\n\n`;

    const newCom = await reddit.submitComment({
      id: originalComment.postId,
      text: pinnedComment,
    });

    messageText +=
      `You can view pinned comment [here](${newCom.permalink}).\n\n` +
      `Note:\n\n> ${pinNote}\n\n` +
      `Thanks for contributing!\n\n~ r/${subreddit.name} Mod Team\n\n`;

    newCom.distinguish(true);
    if (autoLock) newCom.lock();

    if (alertUser) {
      const mm = await reddit.modMail.createConversation({
        subredditName: subreddit.name,
        to: originalComment.authorName,
        isAuthorHidden: true,
        subject: `Your comment has been pinned`,
        body: messageText,
      });
      await reddit.modMail.archiveConversation(mm.conversation.id!);
    }

    await reddit.addModNote({
      subreddit: subreddit.name,
      user: originalComment.authorName,
      label: "HELPFUL_USER",
      note: `Comment pinned by ${appUser?.username}.`,
      redditId: originalComment.postId,
    });

    if (sendModmail) {
      const notif = await reddit.modMail.createModNotification({
        bodyMarkdown: notificationForMods,
        subredditId: subreddit.id,
        subject: `${appUser?.username} has used Spotlight`,
      });

      if (autoArchiving) {
        await reddit.modMail.archiveConversation(notif);
      }
    }

    ui.showToast(`Posted!`);
  }
);



export const pinThatCommentAsMod = Devvit.createForm(
  {
    title: "Pin that comment",
    fields: [
      {
        name: "modNote",
        label: "Note",
        helpText: "Optional",
        type: "string",
      },
    ],
  },
  async (_event, context) => {
      const { reddit, ui } = context;
      const subreddit = await context.reddit.getCurrentSubreddit();
      const commentId = await context.commentId!;
      const modName = await context.reddit.getCurrentUser();
      const originalComment = await context.reddit.getCommentById(commentId);
      const commentLink = (await context.reddit.getCommentById(commentId))
        .permalink;
      const commentText = (await context.reddit.getCommentById(commentId)).body
        ?.split("\n\n")
        .join("\n\n> ");
      const pinNote = _event.values.modNote;
  
      const setSpotlightPostFlair = (await context?.settings.get(
        "setFlair",
      )) as boolean;
      const spotlightFlairText = (await context?.settings.get(
        "spotlightPostFlairText",
      )) as string;
  
  
      const alertUser = (await context?.settings.get("alertUser")) as boolean;
      const sendModmail = (await context?.settings.get("sendModmail")) as boolean;
      const sendtoDiscord = (await context?.settings.get(
        "sendDiscord",
      )) as boolean;
      const autoLock = (await context?.settings.get("autoLock")) as boolean;
  
      const autoArchiving = await context.settings.get<boolean>("autoArchive");
  
      var messageText = `Hello u/${originalComment.authorName},\n\n`;
  
      messageText += `We would like to inform you that your [comment](https://reddit.com${commentLink}) has been pinned by moderators.\n\n`;
  
      var notificationForMods = `**${modName?.username}** has pinned the [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}.\n\n`;
      notificationForMods += `[Recent uses](https://reddit.com/r/${subreddit.name}/w/spotlight/logs) | [Config](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app) | [Feedback](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n`;
  
      if (!pinNote) {
        var pinnedComment = `Mods have pinned a [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}:\n\n`;
        pinnedComment += `> ${commentText}\n\n`;
        pinnedComment += `^([What is Spotlight?](https://developers.reddit.com/apps/spotlight-app))\n\n`;
  
        const newCom = await context.reddit.submitComment({
          id: originalComment.postId,
          text: pinnedComment,
        });
  
        ((messageText += `You can view a pinned comment [here](${newCom.permalink}).\n\n`),
          (messageText += `Thanks for contributing!\n\n`),
          (messageText += `~ r/${subreddit.name} Mod Team\n\n`));
  
        newCom.distinguish(true);
  
        if (autoLock == true) {
          newCom.lock();
        }
        submitPostReply;
        if (!setSpotlightPostFlair){
        console.log("Skipped setting post flair..")
      } else {
        console.log("Setting post flair...");
        const postFlair = await context.reddit.setPostFlair({
          subredditName: subreddit.name,
          postId: originalComment.postId,
          text: spotlightFlairText,
        });
      };
        ui.showToast(`Posted!`);
  
        await context.reddit.addModNote({
          subreddit: subreddit.name,
          user: originalComment.authorName,
          label: "HELPFUL_USER",
          note: `Comment pinned by ${modName?.username} (mod).`,
          redditId: originalComment.postId,
        });
  
        if (!alertUser) {
          console.log("No alerting.");
        } else {
          console.log("Alerting user...");
  
          const messageToUser = await context.reddit.modMail.createConversation({
            subredditName: subreddit.name,
            to: originalComment.authorName,
            isAuthorHidden: true,
            subject: `Your comment has been pinned by mods`,
            body: messageText,
          });
          await context.reddit.modMail.archiveConversation(messageToUser.conversation.id!);
        }
  
        if (!sendModmail) {
          console.log("No mod-alerting.");
        } else {
          console.log("Alerting mods...");
          const appNotification = await context.reddit.modMail.createModNotification({
            bodyMarkdown: notificationForMods,
            subredditId: subreddit.id,
            subject: `${modName?.username} has used Spotlight`,
          });
        if (!autoArchiving) {
            console.log("Subreddit has disabled auto-archiving app notifications.");
          } else {
            console.log("Subreddit has enabled auto-archiving app notifications..");
            await context.reddit.modMail.archiveConversation(appNotification);
            console.log("App notification archived!");
          }
        }
  
        function CurrentCETDateTime(): string {
          const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
          return cetTime.toISOString().slice(0, 19).replace("T", " ") + " CET";
        }
  
        const wikiPageName = "spotlight/logs";
        let wikiPage: WikiPage | undefined;
        try {
          wikiPage = await context.reddit.getWikiPage(
            subreddit.name,
            wikiPageName,
          );
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
  
        const webhook = (await context?.settings.get("webhook")) as string;
  
        if (!webhook) {
          console.error("No webhook URL provided");
          return;
        } else {
          try {
            let payload;
  
            if (sendtoDiscord == false) {
              console.log("Not sending to Discord, skipping...");
            } else {
              const discordRole = await context.settings.get("discordRole");
  
              let discordAlertMessage;
              discordAlertMessage = `**${modName?.username} (mod)** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}.\n\n`;
  
              if (discordRole) {
                discordAlertMessage += `<@&${discordRole}>`;
              } else {
                discordAlertMessage;
              }
  
              if (webhook.startsWith("https://discord.com/api/webhooks/")) {
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
                          name: "Config",
                          value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
                          inline: true,
                        },
                        {
                          name: "Feedback",
                          value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
                          inline: true,
                        },
                      ],
                    },
                  ],
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
              } catch (err) {
                console.error(`Error sending alert: ${err}`);
              }
            }
          } catch (err) {
            console.error(`Error sending alert: ${err}`);
          }
        }
        ui.showToast(`Posted!`);
      } else {
        var pinnedComment = `Mods have pinned a [comment](https://reddit.com${commentLink}) by u/${originalComment.authorName}:\n\n`;
        pinnedComment += `> ${commentText}\n\n`;
        pinnedComment += `**Note:** ${pinNote}\n\n`;
        pinnedComment += `^([What is Spotlight?](https://developers.reddit.com/apps/spotlight-app))\n\n`;
  
        const newCom = await context.reddit.submitComment({
          id: originalComment.postId,
          text: pinnedComment,
        });
  
        ((messageText += `You can view pinned comment [here](${newCom.permalink}).\n\n`),
          (messageText += `**Note from mods**: ${pinNote}\n\n`),
          (messageText += `Thanks for contributing!\n\n`),
          (messageText += `~ r/${subreddit.name} Mod Team\n\n`));
  
        newCom.distinguish(true);
        if (autoLock == true) {
          newCom.lock();
        }
  
        if (!alertUser) {
          console.log("No alerting.");
        } else {
          console.log("Alerting user...");
          const messageToUser = await context.reddit.modMail.createConversation({
            subredditName: subreddit.name,
            to: originalComment.authorName,
            isAuthorHidden: true,
            subject: `Your comment has been pinned by mods`,
            body: messageText,
          });
         await context.reddit.modMail.archiveConversation(messageToUser.conversation.id!);
        }
  
        await context.reddit.addModNote({
          subreddit: subreddit.name,
          user: originalComment.authorName,
          label: "HELPFUL_USER",
          note: `Comment pinned by ${modName?.username} (mod).`,
          redditId: originalComment.postId,
        });
  
        if (!sendModmail) {
          console.log("No mod-alerting.");
        } else {
          console.log("Alerting mods...");
          const appNotification = await context.reddit.modMail.createModNotification({
            bodyMarkdown: notificationForMods,
            subredditId: subreddit.id,
            subject: `${modName?.username} has used Spotlight`,
          });
        if (!autoArchiving) {
            console.log("Subreddit has disabled auto-archiving app notifications.");
          } else {
            console.log("Subreddit has enabled auto-archiving app notifications..");
            await context.reddit.modMail.archiveConversation(appNotification);
            console.log("App notification archived!");
          }
        }
  
        function CurrentCETDateTime(): string {
          const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
          return cetTime.toISOString().slice(0, 19).replace("T", " ") + " CET";
        }
  
        const wikiPageName = "spotlight/logs";
        let wikiPage: WikiPage | undefined;
        try {
          wikiPage = await context.reddit.getWikiPage(
            subreddit.name,
            wikiPageName,
          );
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
  
        const webhook = (await context?.settings.get("webhook")) as string;
  
        if (!webhook) {
          console.error("No webhook URL provided");
          return;
        } else {
          try {
            let payload;
  
            if (sendtoDiscord == false) {
              console.log("Not sending to Discord, skipping...");
            } else {
              const discordRole = await context.settings.get("discordRole");
  
              let discordAlertMessage;
              discordAlertMessage = `**${modName?.username} (mod)** has used Spotlight to pin [the comment](https://reddit.com${originalComment.permalink}) by u/${originalComment?.authorName}. **Note**: ${pinNote}\n\n`;
  
              if (discordRole) {
                discordAlertMessage += `<@&${discordRole}>`;
              } else {
                discordAlertMessage;
              }
  
              if (webhook.startsWith("https://discord.com/api/webhooks/")) {
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
                          name: "Config",
                          value: `[Link](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app)`,
                          inline: true,
                        },
                        {
                          name: "Feedback",
                          value: `[Link](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)`,
                          inline: true,
                        },
                      ],
                    },
                  ],
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
              } catch (err) {
                console.error(`Error sending alert: ${err}`);
              }
            }
          } catch (err) {
            console.error(`Error sending alert: ${err}`);
          }
        }
        ui.showToast(`Posted!`);
      }
    },
);
