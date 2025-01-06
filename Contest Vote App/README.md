# Contest Vote App

Welcome to the **Contest Vote App**! This app is designed to make your subreddit contests fair and transparent by replacing anonymous upvotes with controlled votes, ensuring only eligible users can participate. Votes are securely stored and displayed on a dedicated wiki page for full transparency.

---

## Features
- **Controlled Voting**: Define specific eligibility criteria such as account age and flair.
- **Customizable Rules**: Adjust voting rules to suit your community’s needs.
- **Transparent Logs**: Voting logs and results are saved on wiki pages accessible to moderators.
- **Error Handling**: Users are notified with detailed reasons if their vote is not accepted.
- **Moderator Tools**: View, remove, or clear votes from the database.

---

## How to Use

### Step 1: Install the App
1. Go to the [Devvit App Directory](https://developers.reddit.com/apps/) and install the **Contest Vote App** on your subreddit.
2. Once installed, the app will automatically set up the required wiki pages (perms: mod only) and send you a welcome message in Modmail.

---

### Step 2: Configure the App
1. Access the app’s settings via the [Config Page](https://developers.reddit.com/r/YOUR_SUBREDDIT_NAME/apps/contest-vote):
    - **Enable Voting**: Toggle the `Enable voting?` option to activate or deactivate voting.
    - **Flair ID**: Enter the `Flair ID` of posts eligible for voting.
    - **Account Age**: Set the minimum age (in days) required for users to vote.
    - **Flair CSS Class**: Specify the user flair CSS class required to vote.
2. Save your settings.
    - **Required Settings**: Both Account Age and Flair CSS Class must be defined for the app to function properly.

#### Step 2.1: Configure User Flair and AutoMod

The app automatically creates a user flair titled "Verified contest participant" and updates your AutoMod script (with user flair ID) to handle participant verification. However, due to Reddit API limitations, you need to manually assign the CSS class verified to this flair:

1. Go to your subreddit’s User Flair Settings.
2. Locate the flair titled "Verified contest participant".
3. Edit this flair and add the CSS class 'verified'.
4. Save your changes.

##### Default AutoMod Settings

When installed, the app adds the following rules to your AutoMod configuration:

1. **Trigger**: When users comment !contest.
2. **Minimum Subreddit Karma**: 50 (users must have at least 50 subreddit karma to participate).
3. **Action**: Assign the "Verified contest participant" flair to eligible users and notify them with a confirmation message.

These settings were added to simplify setup but can be customized in your AutoMod configuration. Feel free to adjust them to better fit your community's needs!

---

### Step 3: Running a Contest
1. **Announce the Contest**:
    - Inform your community about the contest rules and voting eligibility.
2. **Enable Voting**:
    - Ensure `Enable voting?` is toggled to `ON` in the settings.
3. **Monitor Logs**:
    - Check the [Logs Wiki Page](https://reddit.com/r/YOUR_SUBREDDIT_NAME/w/contest-vote/logs) to track votes and any issues.

---

### Step 4: Managing Votes
- **View Voters**:
    - Use the **[Contest Vote] Show all users from database** menu option to get a list of all voters.
- **Remove a Vote**:
    - Use the **[Contest Vote] Remove User from database** option to remove a specific user’s vote.
    - Provide the username and an optional note.
- **Clear All Votes**:
    - Use the **[Contest Vote] Remove all users from database** option to reset the voting database.

---

## Wiki Pages

1. **Contest Vote Wiki**
    - Access it at: [https://reddit.com/r/YOUR_SUBREDDIT_NAME/w/contest-vote](https://reddit.com/r/YOUR_SUBREDDIT_NAME/w/contest-vote)
    - Contains links to logs, votes, and error codes.
    - Logs and Votes wiki pages are, by default, **visible only to moderators**. After the contest ends, moderators can make these pages public if desired.

2. **Logs Wiki**
    - Access it at: [https://reddit.com/r/YOUR_SUBREDDIT_NAME/w/contest-vote/logs](https://reddit.com/r/YOUR_SUBREDDIT_NAME/w/contest-vote/logs)
    - Tracks all voting attempts, reasons for failure, and successful votes.

3. **Votes Wiki**
    - Access it at: [https://reddit.com/r/YOUR_SUBREDDIT_NAME/w/contest-vote/votes](https://reddit.com/r/YOUR_SUBREDDIT_NAME/w/contest-vote/votes)
    - Displays all recorded votes for the contest.

---

## Error Codes

- **VOTING_DISABLED**: Voting is not enabled.
- **MISSING_FLAIR**: User does not have the required flair.
- **LOW_ACC_AGE**: User’s account is too new to vote.
- **ALREADY_VOTED**: User has already voted.
- **NOT_CONTEST_POST**: The post is not part of the contest.

---

## Moderator Tools

### Menu Options:
- **[Contest Vote] Show all users from database**:
    - View a list of all users who have voted.
- **[Contest Vote] Remove User from database**:
    - Remove a specific user’s vote with an optional note.
- **[Contest Vote] Remove all users from database**:
    - Clear all votes and restart the voting process.

---

## FAQs

### What happens if a user tries to vote but is ineligible?
- The user will receive a private message explaining why their vote was not recorded. The reason will also be logged on the **Logs Wiki Page**.

### Can moderators vote?
- Yes, moderators can vote if they meet the eligibility criteria set in the app’s settings.

### How do I restart a contest?
1. Clear all votes using the **[Contest Vote] Remove all users from database** option.
2. Adjust settings as needed and enable voting.

---

## Source Code and License

The source code for the Contest Vote App is available on [GitHub](https://github.com/vertesela/Devvit/tree/main/Contest%20Vote%20App).

This project is licensed under the [BSD-3-Clause License](https://opensource.org/license/bsd-3-clause). This app was developed in compliance with [Reddit's Developer Terms](https://redditinc.com/policies/developer-terms) and adheres to the guidelines for the Devvit platform.

## Support

If you encounter any issues or have questions, please contact me [via Modmail](https://reddit.com/message/compose?to=/r/paskapps&subject=Contest%20Vote%20App%20-%20feedback&message=Text%3A%20).

Thank you for using Contest Vote App! I hope it enhances your community’s contests and makes them fairer and more transparent.

