# MultiPinger — Send a message to multiple users at once

Moderators often need to contact several users with the same information: follow-ups, clarifications, rule notices, AMA coordination, or community outreach. Sending these messages one by one is slow and error-prone. MultiPinger solves that.

MultiPinger is a Dev Platform app that lets moderators send a single message to multiple users at the same time, with full logging, optional anonymity, and support for image attachments.

---

## What MultiPinger does

- Sends a single message to multiple users in separate, individual Reddit messages

- Optionally sends the message as the subreddit (anonymous mode)

- Supports attaching an image (uploaded to Reddit’s CDN and included as a link)

- Creates a Modmail log for every action, including recipients, message content, and moderator attribution

- Allows moderators to auto-archive bot-created messages

- Lets teams restrict access to the app with permission checks

All of this can be configured in the app settings.

---

## How it works

1. Open the MultiPinger form.

2. Enter one or more usernames.

3. Write your message.

4. (Optional) Attach an image.

5. Choose whether to send anonymously or under your username.

6. Confirm the action.

MultiPinger sends individual messages to each user and immediately posts a Modmail entry with the details for audit and team transparency.

That’s all you need to do.

---

## Image support

MultiPinger allows moderators to attach a single image.
Images are uploaded to Reddit’s own CDN (i.redd.it) and included in the outgoing message as a link.

Modmail does not currently display image previews, so logs will show the link rather than an embedded thumbnail. The message sent to users will also contain the same link.

This is the only supported method for image delivery through Reddit’s messaging API at this time.

---

## Logging and safety

For security and accountability, every MultiPinger action is logged in Modmail.

This ensures that:

- moderators can always see what was sent

- actions are transparent to the entire team

- potential misuse is easier to detect

- the subreddit has a complete history even if moderators change

Logging cannot currently be disabled. Reddit’s Wiki API does not reliably support writes at this time; once that changes, an alternative logging option may be added.

Moderators should use MultiPinger responsibly and avoid sending unsolicited or repetitive messages that could be treated as spam by Reddit.

---

## Permissions

To use MultiPinger, a moderator must have Mail permissions.
If needed, the app can also be restricted to moderators with full permissions. This can be adjusted in the app settings.

---

## Settings overview

### Auto-archive app messages

Automatically archives messages sent by MultiPinger to keep Modmail organized.

### Permission requirements

Teams may choose whether the app requires Mail permissions or full permissions.

### Modmail logging (required)

A copy of each multiping action is sent to Modmail for auditing and cannot currently be disabled.

---

## What the app logs

A typical Modmail entry includes:

- the moderator who triggered the action (unless anonymous mode is used)

- the full message text

- the recipient list

- the link to the uploaded image, if provided

These logs exist solely for moderation transparency and are not visible to regular users.

---

## Notes on Reddit’s spam policy

MultiPinger does not bypass Reddit’s anti-spam checks.
Sending identical messages to a large number of users in a short period may still trigger rate limits or spam protections.

Moderators should personalize messages when appropriate, avoid unnecessary mass outreach and use the tool only for moderation-related communication.

---

## Source code & license

The source code for the MultiPinger app is available on [GitHub](https://github.com/vertesela/Devvit/tree/main/MultiPinger).

This project is licensed under the [BSD-3-Clause License](https://opensource.org/licenses/BSD-3-Clause).
This app was developed in compliance with [Reddit's Developer Terms](https://www.redditinc.com/policies/developer-terms) and adheres to the guidelines for the Devvit platform.

---

## Support

If you run into any issues or have questions, please do not message the bot or the app directly because that inbox isn’t monitored. The correct way to reach the developer ([u/paskatulas](https://reddit.com/u/paskatulas)) is through [r/paskapps modmail](https://www.reddit.com/message/compose?to=/r/paskapps), so all reports stay organized in one place.

Thank you for using MultiPinger - hope it helps your subreddit communicate more efficiently and stay better organized.

---
