# 🌟 Spotlight - Pin comments that matter

Sometimes the most helpful comment in a thread comes from someone who isn’t a mod - a company rep, an expert, or just a user with the right context. Normally you can’t pin their reply. Spotlight fixes that.

**Spotlight** is a Dev Platform app that lets moderators, trusted users, and (optionally) the original poster (OP) pin another user’s comment to the top of a post.

---

## What Spotlight does

- **Allows mods, trusted users, and OPs (if enabled) to pin comments**
- **Lets mods remove any comment created by the app**
- **Can automatically apply a post flair when a comment is spotlighted**
- **Supports optional Discord webhook notifications**

All of this can be configured in the app settings.

---

## How to use it

### Trusted users, mods and OPs

1. **Moderators** add trusted users in the [Dev Platform settings](https://developers.reddit.com/apps/spotlight-app) - e.g. verified accounts, popular helpers – up to the mods.

2. To spotlight a comment, open it and select Spotlight from the menu.

3. Fill out the short form and confirm. The comment will be pinned under the post.

That’s all you need to do.

---

### If you're a regular user and want to use Spotlight

- Spotlight isn’t automatically available to everyone. If you’d like the ability to spotlight comments on a specific subreddit, contact that sub’s moderators and ask them to add you as a trusted user.

- Whether they grant access is entirely up to the moderation team of that subreddit.

---

## Optional features

### Automatic flair

- You can set a custom flair that’s applied once a comment is spotlighted.
- Useful for posts where added context or clarification needs to be visible.

#### Example:

```
Context Provided – Spotlight
```

- You can enable this feature and customize the flair text in the app settings

### OP spotlighting

- Mods can allow the original poster to spotlight another user’s comment - helpful for AMAs, Q&A threads, or posts where the OP is actively involved.

### Anonymous spotlight

- Trusted users (and OPs, if enabled) can choose to spotlight a comment without showing their username publicly.

- **Public comment format:**

  > 📌 u/TrustedUser has pinned a comment by u/ExampleUser.

- **Anonymous format:**

  > 📌 Pinned comment from u/ExampleUser.

- Mods will still see who performed the action in the logs.

---

## Mod Tools

- Configure the app through your Dev Platform settings.

- To remove a comment posted by `u/spotlight-app`, open the comment → mod tools → `[Spotlight] Delete content`.

- All spotlight actions are logged in `/w/spotlight/logs` on your subreddit.

---

## What the app posts

Depending on who spotlighted the comment, Spotlight will post:

- **Moderator:**

  > 📌 Mods have pinned a comment by u/{author}.

- **OP:**

  > 📌 u/{OP} has pinned a comment by u/{author}.

- **Trusted user:**

  > 📌 u/{TrustedUser} has pinned a comment by u/{author}.

- **Anonymous:**
  > 📌 Pinned comment from u/{author}.

---

## Resources

- [Setup instructions & feature post](https://www.reddit.com/r/paskapps/comments/1f8cmde/introducing_spotlight_an_app_that_allows_op_and/)
- [Terms & Conditions](https://www.reddit.com/r/paskapps/wiki/spotlight/terms-and-conditions)
- [Privacy Policy](https://www.reddit.com/r/paskapps/wiki/spotlight/privacy-policy)

---

## Source code & license

The source code for the Spotlight app is available on [GitHub](https://github.com/vertesela/Devvit/tree/main/Spotlight).

This project is licensed under the [BSD-3-Clause License](https://opensource.org/licenses/BSD-3-Clause).  
This app was developed in compliance with [Reddit's Developer Terms](https://www.redditinc.com/policies/developer-terms) and adheres to the guidelines for the Devvit platform.

---

## Support

If you run into any issues or have questions, please do not message the bot or the app directly because that inbox isn’t monitored. The correct way to reach the developer ([u/paskatulas](https://reddit.com/u/paskatulas)) is through [r/paskapps modmail](https://www.reddit.com/message/compose?to=/r/paskapps), so all reports stay organized in one place.

Thank you for using Spotlight - hope it helps your subreddit stay clearer, calmer, and more focused.
