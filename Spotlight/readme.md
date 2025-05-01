# 🌟 Spotlight – Pin important comments on Reddit (even if they’re not yours)

Do you moderate a subreddit where a company, organization, or trusted user sometimes comments — but they aren’t a mod?

Ever wanted to pin someone else’s comment to the top of a thread, but couldn’t?

**Spotlight** is a Dev Platform app that allows mods, trusted users, and optionally the original poster (OP) to pin someone else's comment to the top of a post — directly and visibly.

---

## ✅ What Spotlight can do

- **Pin comments** from other users – mods, trusted users, and optionally OPs (if enabled)
- **Delete content** created by the app – mods only
- **Automatically change the post flair** when a comment is spotlighted
- **Send optional webhook alerts** to Discord (configurable by mods)

---

## 🛠 Instructions

### 👥 Trusted Users, Mods & OPs

1. **Moderators** should go to the [Dev Platform settings](https://developers.reddit.com) and add some trusted users who will be allowed to spotlight comments  
   *(e.g. verified accounts, popular helpers – up to the mods)*

2. To spotlight a comment:
   - Click the comment you want to spotlight
   - Select the **Spotlight** option
   - Fill in the form that appears (via Devvit UI), then click OK

3. That’s it! The spotlighted comment will appear pinned directly under the post.

---

### ⚙️ Flair Feature (optional)

You can now set a **custom flair** that will automatically be applied to the post once a comment is spotlighted.

#### Example:
```
Context Provided – Spotlight
```

- Helps alert readers that important context has been added
- You can enable this feature and customize the flair text in the app settings

---

### 👤 OP Support (optional)

Mods can now enable a setting that allows the **original poster (OP)** to spotlight another user's comment.

- When enabled, OP will see the Spotlight option just like trusted users
- Great for AMA threads, curated discussions, or personal clarifications

---

### 🕵️ Anonymous Option

Trusted users (and OPs, if allowed) can choose whether or not their username is shown in the app's public comment.

- **Public comment format:**
  > 📌 u/ExampleUser has pinned this comment.

- **Anonymous format:**
  > 📌 This comment was pinned via Spotlight.

Usernames are still visible to moderators via logs and internal actions.

---

### 🔐 Mods Only

- [Go to Dev Settings](https://developers.reddit.com) to manage your app config

- To delete a comment made by `u/spotlight-app`, simply:
  - Go to the comment
  - Open mod tools → Select **[Spotlight] – Delete content**
  - The comment will be removed

- All spotlight activity is logged in your subreddit’s wiki page:  
  `/w/spotlight/logs` → Updated after every spotlight

---

## 💬 Message & Comment Styles

Depending on who spotlighted the comment, the app will post a comment like:

- **Moderator:**  
  > 📌 Mods have pinned a comment by u/{author}.

- **OP:**  
  > 📌 u/{OP} has pinned a comment by u/{author}.

- **Trusted user:**  
  > 📌 u/{TrustedUser} has pinned a comment by u/{author}.

- **Anonymous:**  
  > 📌 Pinned comment from u/{author}.

---

## 📚 Resources

- [Setup instructions & feature post](https://www.reddit.com/r/paskapps/comments/1f8cmde/introducing_spotlight_an_app_that_allows_op_and/)
- [Terms & Conditions](https://www.reddit.com/r/paskapps/wiki/spotlight/terms-and-conditions)
- [Privacy Policy](https://www.reddit.com/r/paskapps/wiki/spotlight/privacy-policy)

---

## 🔗 Source Code and License

The source code for the Spotlight app is available on [GitHub](https://github.com/vertesela/Devvit/tree/main/Spotlight).

This project is licensed under the [BSD-3-Clause License](https://opensource.org/licenses/BSD-3-Clause).  
This app was developed in compliance with [Reddit's Developer Terms](https://www.redditinc.com/policies/developer-terms) and adheres to the guidelines for the Devvit platform.

---

## 🛠 Support

If you encounter any issues or have questions, please [send a message](https://www.reddit.com/message/compose?to=/r/paskapps).

Thank you for using Spotlight — hope it helps your subreddit stay clearer, calmer, and more focused.