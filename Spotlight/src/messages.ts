
export const WHAT_IS_SPOTLIGHT = 
  `^([What is Spotlight?](https://developers.reddit.com/apps/spotlight-app))\n\n`;

export function PinnedCommentQuote(body?: string): string {
  if (!body) return "> [No content]\n\n";
  return "> " + body.split("\n\n").join("\n\n> ") + "\n\n";
}


// -----------------------------------------------------
//  OP PINNED COMMENT
// -----------------------------------------------------

export function OP_PinnedComment(author: string, permalink: string, body?: string): string {
  return (
`OP has pinned a [comment](https://reddit.com${permalink}) by u/${author}:\n\n` +
PinnedCommentQuote(body) +
WHAT_IS_SPOTLIGHT
  );
}

export function OP_PinnedComment_WithNote(author: string, permalink: string, body: string, note: string) {
  return (
`OP has pinned a [comment](https://reddit.com${permalink}) by u/${author}:\n\n` +
PinnedCommentQuote(body) +
`**Note from OP:** ${note}\n\n` +
WHAT_IS_SPOTLIGHT
  );
}


// -----------------------------------------------------
//  TRUSTED USER PINNED COMMENT
// -----------------------------------------------------

export function TU_PinnedComment(author: string, permalink: string, body?: string): string {
  return (
`Pinned [comment](https://reddit.com${permalink}) from u/${author}:\n\n` +
PinnedCommentQuote(body) +
WHAT_IS_SPOTLIGHT
  );
}

export function TU_PinnedComment_Public(appUser: string, author: string, permalink: string, body?: string): string {
  return (
`u/${appUser} has pinned a [comment](https://reddit.com${permalink}) by u/${author}:\n\n` +
PinnedCommentQuote(body) +
WHAT_IS_SPOTLIGHT
  );
}

export function TU_PinnedComment_WithNote(appUser: string | null, author: string, permalink: string, body: string, note: string, visible: boolean) {
  if (visible) {
    return (
`u/${appUser} has pinned a [comment](https://reddit.com${permalink}) by u/${author}:\n\n` +
PinnedCommentQuote(body) +
`**Note:** ${note}\n\n` +
WHAT_IS_SPOTLIGHT
    );
  }
  return (
`Pinned [comment](https://reddit.com${permalink}) from u/${author}:\n\n` +
PinnedCommentQuote(body) +
`**Note:** ${note}\n\n` +
WHAT_IS_SPOTLIGHT
  );
}


// -----------------------------------------------------
//  MOD PINNED COMMENT
// -----------------------------------------------------

export function Mod_PinnedComment(author: string, permalink: string, body?: string): string {
  return (
`Mods have pinned a [comment](https://reddit.com${permalink}) by u/${author}:\n\n` +
PinnedCommentQuote(body) +
WHAT_IS_SPOTLIGHT
  );
}

export function Mod_PinnedComment_WithNote(author: string, permalink: string, body: string, note: string): string {
  return (
`Mods have pinned a [comment](https://reddit.com${permalink}) by u/${author}:\n\n` +
PinnedCommentQuote(body) +
`**Note:** ${note}\n\n` +
WHAT_IS_SPOTLIGHT
  );
}


// -----------------------------------------------------
//  USER NOTIFICATION MESSAGES (Modmail → user)
// -----------------------------------------------------

// -------------------------
// OP → USER NOTIFICATIONS
// -------------------------

// Case 1: No note
export function NotifyUser_OP(
  author: string,
  permalink: string,
  opUser: string
): string {
  return (
`Hello u/${author},\n\n` +
`We would like to inform you that your [comment](https://reddit.com${permalink}) has been pinned by OP (u/${opUser}).\n\n`
  );
}


// Case 2: With note
export function NotifyUser_OP_WithNote(
  author: string,
  permalink: string,
  opUser: string,
  note: string
): string {
  return (
`Hello u/${author},\n\n` +
`We would like to inform you that your [comment](https://reddit.com${permalink}) has been pinned by OP (u/${opUser}).\n\n` +
`**Note from OP:**\n\n` +
`> ${note}\n\n`
  );
}
// -----------------------------------------------------
// TRUSTED USER → USER NOTIFICATIONS (4 CASES)
// -----------------------------------------------------

// 1) Username visible, no note
export function NotifyUser_TU_Visible(
  author: string,
  permalink: string,
  appUser: string
): string {
  return (
`Hello u/${author},\n\n` +
`We would like to inform you that your [comment](https://reddit.com${permalink}) ` +
`has been pinned by u/${appUser}.\n\n`
  );
}


// 2) Username visible, with note
export function NotifyUser_TU_Visible_WithNote(
  author: string,
  permalink: string,
  tuUser: string,
  note: string
): string {
  return (
`Hello u/${author},\n\n` +
`We would like to inform you that your [comment](https://reddit.com${permalink}) ` +
`has been pinned by u/${tuUser}.\n\n` +
`**Note:**\n\n` +
`> ${note}\n\n`
  );
}


// 3) Username hidden, no note
export function NotifyUser_TU_Anonymous(
  author: string,
  permalink: string
): string {
  return (
`Hello u/${author},\n\n` +
`We would like to inform you that your [comment](https://reddit.com${permalink}) ` +
`has been pinned by a trusted user.\n\n`
  );
}


// 4) Username hidden, with note
export function NotifyUser_TU_Anonymous_WithNote(
  author: string,
  permalink: string,
  note: string
): string {
  return (
`Hello u/${author},\n\n` +
`We would like to inform you that your [comment](https://reddit.com${permalink}) ` +
`has been pinned by a trusted user.\n\n` +
`**Note:**\n\n` +
`> ${note}\n\n`
  );
}

// -----------------------------------------------------
// MODERATORS → USER NOTIFICATIONS (2 CASES)
// -----------------------------------------------------

// 1) No note
export function NotifyUser_Mod(
  author: string,
  permalink: string
): string {
  return (
`Hello u/${author},\n\n` +
`We would like to inform you that your [comment](https://reddit.com${permalink}) ` +
`has been pinned by the moderators.\n\n`
  );
}


// 2) With note
export function NotifyUser_Mod_WithNote(
  author: string,
  permalink: string,
  note: string
): string {
  return (
`Hello u/${author},\n\n` +
`We would like to inform you that your [comment](https://reddit.com${permalink}) ` +
`has been pinned by the moderators.\n\n` +
`**Note from mods:**\n\n` +
`> ${note}\n\n`
  );
}


// -----------------------------------------------------
//  MODMAIL NOTIFICATIONS (to moderators)
// -----------------------------------------------------

export function ModmailNotice(who: string, permalink: string, author: string, subreddit: string): string {
  return (
`**${who}** has pinned the [comment](https://reddit.com${permalink}) by u/${author}.\n\n` +
`[Recent uses](https://reddit.com/r/${subreddit}/w/spotlight/logs) | ` +
`[Config](https://developers.reddit.com/r/${subreddit}/apps/spotlight-app) | ` +
`[Feedback](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n`
  );
}


// -----------------------------------------------------
//  DISCORD TEMPLATES
// -----------------------------------------------------

export function DiscordMessage(who: string, permalink: string, author: string, note?: string): string {
  let msg = `**${who}** has used Spotlight to pin [the comment](https://reddit.com${permalink}) by u/${author}.`;
  if (note) msg += ` **Note:** ${note}`;
  return msg + `\n\n`;
}


// -----------------------------------------------------
//  INSTALL / UPDATE
// -----------------------------------------------------

export function InstallMessage(subredditName: string): string {
  let firstMsg = `Hello r/${subredditName} mods,\n\n`;

  firstMsg += `Thanks for installing Spotlight!\n\n`;
  firstMsg += `This intuitive tool allows your trusted users and OPs to pin comments from other users.\n\n`;
  firstMsg += `Users can write comments through a simple form and mods are able to pin user's comments by clicking "Pin that comment".\n\n`;
  firstMsg += `You can set a list of trusted users [here](https://developers.reddit.com/r/${subredditName}/apps/spotlight-app).\n\n`;
  firstMsg += `[Instructions](https://www.reddit.com/r/paskapps/comments/1f8cmde/introducing_spotlight_an_app_that_allows_op_and/) | [Recent uses](https://reddit.com/r/${subredditName}/w/spotlight/logs) | [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n\n`;

  return firstMsg;
}

export function UpdateMessage(subredditName: string): string {
  let updateMsg = `Hello r/${subredditName} mods,\n\n`;

  updateMsg += `You're receiving this message because **Spotlight** has just been updated on r/${subredditName}.\n\n`;

  updateMsg += `**What's new?**\n\n`;
  updateMsg += `- Fixed an issue where users did not receive notifications after their comment was spotlighted.\n\n`;
  updateMsg += `- Fixed post flair bug.\n\n`;
  updateMsg += `- Reddit has recently introduced a new option that lets moderators allow app developers to view installation history and stream logs for their apps. This can be enabled in the developer permissions section of [the app settings](https://developers.reddit.com/r/${subredditName}/apps/spotlight-app). I recommend turning this on - it helps developers identify and resolve issues much faster and makes support significantly easier.\n\n`;

  updateMsg += `**Quick note:**\n\n`;
  updateMsg += `Spotlight was mentioned as one of the most popular apps during the recent [Reddit Mod World](https://www.reddit.com/r/ModEvents/comments/1og0es3/thanks_everyone_who_watched_our_devvit_panel_hope/) event. In just a little over a year of active development, the app has surpassed **950 installations** across Reddit.\n\n`;
  updateMsg += `Thank you all for using Spotlight and for the feedback that helped shape this update.\n\n`;
  updateMsg += `~ u/paskatulas\n\n`;

  updateMsg += `*Please note that this conversation is read-only. If you have any suggestions or feedback, you can reach me [here](https://reddit.com/message/compose?to=/r/paskapps&subject=App%20Feedback%3A%20Spotlight&message=Text%3A%20).*\n\n`;

  return updateMsg;
}
