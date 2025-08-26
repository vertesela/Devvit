# Press App - publish official mod posts without shared accounts

Do you moderate a subreddit where mods need to publish “official” announcements, rules updates, AMA posts, monthly stickies… but you don’t want a shared mod account (or constant copy-paste)?

**Press App** lets moderators draft and publish official **posts** and **pinned mod comments** — fast, consistent, and with a clear audit trail.

---

## ✅ What Press App can do

- **Create & publish official mod posts** (text) with one-click **Distinguish** and **Sticky**.
- **Publish pinned mod comments** (also with **Distinguish** and **Sticky** options).
- **Automatic internal mod note** after each publish, showing **who** posted and linking directly to the post/comment.
- **Modmail notifications (default ON)** on submit **and** on edit of a mod post
  – Useful for long announcements: if someone accidentally removes/overwrites content, you’ll still have the copy in modmail.
- **Discord notifications (optional)** via webhook URL
  – Heads-up: very long posts can hit Discord payload limits and may fail to deliver there!
- **Auto-flair (optional)**
  - **After posting:** apply a chosen post flair (e.g., _Mod Post_).
  - **After commenting:** when a **mod comments via Press App**, automatically change flair (e.g., _Mods Replied_).

- **Templates (new!)** — define reusable title/body snippets (any language).
  – Up to **3 templates** per subreddit.
- **Permanent delete** of posts/comments created via the app (not just “remove”).

> **Coming soon:** **Post scheduling** (publish at a set time) & **Event reminders** (subscribe to a draft → get a Reddit PM when it’s time)

---

## 🛠️ Instructions

### Install & Configure

1. Install **Press App** in your sub’s **Dev Platform** settings.
2. (Optional) In Press App settings, add a **Discord webhook** if you want Discord alerts.
3. (Optional) Configure **Auto-flair**:
   - _Enable auto-flair after posting_ → pick label (e.g., _Mod Post_).
   - _Enable auto-flair after commenting_ → pick label (e.g., _Mods Replied_).

### Publish an official **post**

1. Open **Press App → New Post**.
2. Start from scratch **or** click **Use template** (see Templates below).
3. Toggle **Distinguish** / **Sticky** (and other options if available).
4. **Publish.**
   - An **internal mod note** is added automatically (actor + direct link).
   - A **modmail** message is sent **by default** (on submit and on later edits).

### Publish a pinned **mod comment**

1. Open **Press App → New Comment** (or from a thread context if available).
2. Write the comment, toggle **Distinguish** / **Stick**, then **Publish**.
3. If “auto-flair after commenting” is enabled, the post flair updates automatically.

### Delete content created by the app

- Use **Press App → Delete** to **permanently delete** the app’s post/comment.

  > This is irreversible—use carefully.

---

## 🎨 Templates (new!)

- Add/edit templates in app settings:
  `https://developers.reddit.com/r/YOUR_SUBREDDIT/apps/press-app`
- You can store **up to 3** per subreddit.
- In the Press App menu choose **Use template** to prefill **Title** and **Body**; you can still edit before publishing.
- Works with **any language/locale** (great for AMA announcements, rules changes, monthly stickies).

---

## 🔁 Clone Post (quick reuse)

Need to refresh a monthly sticky or re-run an AMA post? Use **Clone** to copy any existing post into a new draft and update only what changed.

**How it works**

1. Open **Press App → Posts** (or the post’s context in the app) and click **Clone** on the post you want to reuse.
2. That's it. App has created a new post with the same title, body, and options (sticky, distinguish, etc.). The internal **mod note** and **modmail** include a link back to the original post and a short change summary.

---

## 🔔 Notifications & Logs

- **Modmail (default ON):** sent on **submit** and on **edit** for mod posts—keeps a durable copy for the team.
- **Discord (optional):** posts to your configured webhook (subject to Discord limits).
- **Internal mod notes:** created automatically after publishing, with the actor and direct link.

---

## 🔒 Mods Only

- Manage Press App options in **Dev Settings** (templates, auto-flair, Discord webhook, defaults).
- All content remains subject to your subreddit’s rules and Reddit policies.

---

## 📚 Resources

- [Terms & Conditions](https://www.reddit.com/mod/paskapps/wiki/press-app/terms-and-conditions)
- [Privacy Policy](https://www.reddit.com/mod/paskapps/wiki/press-app/privacy-policy)

---

## 🧾 Source & License

The source code for the Press app is available on [GitHub](https://github.com/vertesela/Devvit/tree/main/Press%20App).

This project is licensed under the [BSD-3-Clause License](https://opensource.org/licenses/BSD-3-Clause).
This app was developed in compliance with [Reddit's Developer Terms](https://www.redditinc.com/policies/developer-terms) and adheres to the guidelines for the Devvit platform.

---

## 🆘 Support

If you encounter any issues or have questions, please send a [message](https://reddit.com/message/compose?to=/r/paskapps&subject=Press%20App&message=Feedback%3A%20).

Thanks for using **Press App** — publish faster, safer, and without shared accounts.
