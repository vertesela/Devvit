import { Devvit, WikiPage, WikiPagePermissionLevel } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true, // Enable access to the Reddit API
  redis: true
});

Devvit.addSettings([
  {
    name: 'voteCheck',
    type: "boolean",
    label: "Enable voting?",
    defaultValue: false
  },
  {
    name: 'flairID',
    type: "string",
    label: "Flair ID of contest posts",
  },
  {
    type: 'group',
    label: 'Rules',
    helpText: 'Who can vote?',
    fields: [
      {
        type: 'number',
        name: 'accAge',
        label: 'Account age (in days)',
      },
      {
        name: 'accountFlairCSSclass',
        type: "string",
        label: "User flair CSS class",
        helpText: 'User with this flair CSS class can vote.',
        defaultValue: 'verified'
      }
    ]
},
]);

Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) {
  
    console.log(`App installed on r/${event.subreddit?.name} by ${event.installer?.name}.`);

    const subreddit = await context.reddit.getCurrentSubreddit();

    var firstMsg = `Hello r/${subreddit.name} mods,\n\n`;
    
    firstMsg += `Thanks for installing Contest Vote App!\n\n`,
    
    firstMsg += `This app allows you to run fair and transparent contests by replacing anonymous upvotes with controlled votes, ensuring only eligible users can participate.\n\n`,

    firstMsg += `Votes are securely stored and will be displayed on a wiki page for full transparency. Please take a look at README page and customize voting rules to fit your community's needs!\n\n`;
        
    firstMsg += `[README](https://developers.reddit.com/apps/contest-vote/) | [Config](https://developers.reddit.com/r/${subreddit.name}/apps/contest-vote) |  [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=Contest-Vote&message=Text%3A%20)\n\n\n`;

    function CurrentCETDateTime(): string {
      const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
      return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
  } 


    const wikiPageName = "contest-vote";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    var pageContents = `* [Config - mods only!](https://developers.reddit.com/r/${subreddit.name}/apps/contest-vote)\n\n`;
    pageContents += `* [Logs](https://reddit.com/r/${subreddit.name}/w/contest-vote/logs)\n\n`;
    pageContents += `* [Votes](https://reddit.com/r/${subreddit.name}/w/contest-vote/votes)\n\n`;
    pageContents += `* [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=Contest-Vote&message=Text%3A%20)\n\n`;
    pageContents += `---\n\n`;
    pageContents += `# Error codes\n\n`;

    pageContents += `* VOTING_DISABLED - voting is not enabled yet.\n\n`;
    pageContents += `* MISSING_FLAIR - account doesn't have the required user flair to participate in that contest.\n\n`;
    pageContents += `* LOW_ACC_AGE - account is too new to vote in that contest.\n\n`;
    pageContents += `* ALREADY_VOTED - user has already voted in that contest.\n\n`;
    pageContents += `* NOT_CONTEST_POST - the post user attempted to vote on is not part of the contest.\n\n`;

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
            permLevel: WikiPagePermissionLevel.SUBREDDIT_PERMISSIONS,
        });
    }
    console.log("Wiki page updated (first time).");

    const wikiPageName2 = "contest-vote/logs";
      let wikiPage2: WikiPage | undefined;
    try {
        wikiPage2 = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

     var pageLog = `App installed on ${CurrentCETDateTime()}.\n\n\n`;
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

    const wikiPageName3 = "contest-vote/votes";
      let wikiPage3: WikiPage | undefined;
    try {
        wikiPage2 = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

     var pageLog = `App installed on ${CurrentCETDateTime()}.\n\n\n`;
      pageLog += `---\n\n`;

      const wikiPageOptions3 = {
        subredditName: subreddit.name,
        page: wikiPageName3,
        content: pageLog,
        reason: `App installed.`,
    };
  

    if (wikiPage2) {
        await context.reddit.updateWikiPage(wikiPageOptions2);
    } else {
        await context.reddit.createWikiPage(wikiPageOptions2);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: wikiPageName3,
            listed: true,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
    console.log("First log.");


    await context.reddit.modMail.createConversation({
      body: firstMsg,
      isAuthorHidden: false,
      subredditName: subreddit.name,
      subject: `Thanks for installing Contest Vote App!`,
      to: null,
    })
    console.log("First message sent!");

    const contestUserFlair = await context.reddit.createUserFlairTemplate({
      subredditName: subreddit.name,
      modOnly: true,
      text: `Verified Contest Participant`
    });


    const autoModWikiName = "config/automoderator";
      let autoModPage: WikiPage | undefined;
    try {
        autoModPage = await context.reddit.getWikiPage(subreddit.name, autoModWikiName);
    } catch {
        //
    }

    var autoModPageContent = `${autoModPage?.content}\n\n`;
    autoModPageContent += `## Contest Participation Check\n`;
    autoModPageContent += `type: comment\n`;
    autoModPageContent += `moderators_exempt: false\n`;
    autoModPageContent += `body (full-text): '!contest'\n`;
    autoModPageContent += `action: remove\n`;
    autoModPageContent += `action_reason: Contest Participation Check\n`;
    autoModPageContent += `author:\n`;
    autoModPageContent += `    is_moderator: false\n`;
    autoModPageContent += `    combined_subreddit_karma: "> 50"\n`;
    autoModPageContent += `    set_flair:\n`;
    autoModPageContent += `        template_id: ${contestUserFlair.id}\n`;
    autoModPageContent += `    overwrite_flair: true\n`;
    autoModPageContent += `message_subject: "Verified!"\n\n`;
    autoModPageContent += `message: "Hey u/{{author}}, great news! You have been verified and you can now vote!"\n`;
    autoModPageContent += `---\n\n`;

      const autoModPageOption = {
        subredditName: subreddit.name,
        page: autoModWikiName,
        content: autoModPageContent,
        reason: `Added script for Contest Participation Check`,
    };
  

    if (autoModWikiName) {
        await context.reddit.updateWikiPage(autoModPageOption);
    } else {
        await context.reddit.createWikiPage(autoModPageOption);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: autoModWikiName,
            listed: true,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
    console.log("AutoMod page updated (first time).");

}
}
); 

Devvit.addTrigger({
  event: 'ModMail',
  async onEvent(event, context) {
  
    try {
    if (event.messageAuthor?.name.includes('contest-vote')) {
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
);

Devvit.addMenuItem({
  location: 'post',
  label: '[Contest Vote] Vote',
  description: 'Use this option to vote on Contest posts!',
  onPress: async (event, context) => {

    const subreddit = await context.reddit.getCurrentSubreddit();
    const voter = await context.reddit.getCurrentUser();

    const postId = context.postId!;
    const post = await context.reddit.getPostById(postId);
    const postFlair = post.flair?.templateId;
    const userFlair = await voter?.getUserFlairBySubreddit(subreddit.name);
    const userFlairCSSclass = userFlair?.flairCssClass;


    const settings = await context.settings.getAll();
    var votingEnabled = await context.settings.get<boolean>(('voteCheck'));
    var contestFlairID = await context.settings.get<string>(('flairID'));
    var requiredUserFlairCSSclass = await context.settings.get<string>(('accountFlairCSSclass'));
    var requiredAccountAge = await context.settings.get<number>(('accAge'));

    if (!requiredAccountAge){
      requiredAccountAge = 1;
    };


    var successMessage = `Hello u/${voter?.username},\n\n`;
    successMessage += `Thanks for voting. Your vote has been recorded!\n\n`,
    successMessage += `**Vote details**:\n\n\n\n`;
    successMessage += `Author: u/${post.authorName}\n\n`;
    successMessage += `Permalink: https://reddit.com${post.permalink}\n\n`;
    successMessage += `~ r/${subreddit.name} Mod Team\n\n\n`;

    function CurrentCETDateTime(): string {
      const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
      return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
  }  

    if (!voter){
      return console.log("No voter found!");
    };

    function getDaysSinceAccountCreation(accountCreatedAt: Date): number {
      const now = new Date();
      const diffInMilliseconds = now.getTime() - accountCreatedAt.getTime();
      return Math.floor(diffInMilliseconds / (1000 * 60 * 60 * 24)); // Convert milliseconds to days
  }
    
    // Usage example:
    const userAccountAge = getDaysSinceAccountCreation(voter?.createdAt);

    // Retrieve the set of voters
    const key = `votes`;

    // Retrieve the list of voters
    const voters = await context.redis.get(key);
    const voterArray: string[] = voters ? JSON.parse(voters) : [];


    var unsuccessMessage = `Hello u/${voter.username},\n\n`;
    unsuccessMessage += `Thanks for voting. Unfortunately, your vote cannot be recorded!\n\n`,
    unsuccessMessage += `**Vote details**:\n\n\n\n`;
    unsuccessMessage += `Author: u/${post.authorName}\n\n`;
    unsuccessMessage += `Permalink: https://reddit.com${post.permalink}\n\n`;


    if (!votingEnabled){
      console.log(`u/${voter?.username} tried to vote, but voting is not enabled yet.`);
      const wikiPageName = "contest-vote/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `⚠️ ${CurrentCETDateTime()} - u/${voter?.username} attempted to vote for [this post](https://reddit.com${post.permalink}) by u/${post.authorName}. **Reason**: VOTING_DISABLED\n\n\n`;
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
    };


    return context.ui.showToast("Sorry, voting is not enabled yet!");
    } else {
    if (requiredUserFlairCSSclass != userFlairCSSclass){

      console.log(`u/${voter?.username} doesn't have user flair needed for contest participation (${requiredUserFlairCSSclass} | ${userFlairCSSclass}).`);
      
      const wikiPageName = "contest-vote/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `⚠️ ${CurrentCETDateTime()} - u/${voter?.username} attempted to vote for [this post](https://reddit.com${post.permalink}) by u/${post.authorName}. **Reason**: MISSING_FLAIR\n\n\n`;
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
    };

     const reasonD = `[MISSING_FLAIR](https://www.reddit.com/r/${subreddit.name}/w/contest-vote/#wiki_error_codes)`;

    unsuccessMessage += `Reason: ${reasonD}\n\n`;
    unsuccessMessage += `~ r/${subreddit.name} Mod Team\n\n\n`;

    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: voter?.username,
      subject: `Unsuccessful voting`,
      text: unsuccessMessage
    })
      return context.ui.showToast("You don't have user flair needed for contest participation!"); 
    } else {
      console.log(`u/${voter?.username} - flair ok!`);

      if (userAccountAge < requiredAccountAge) {

        console.log(`u/${voter?.username} has low account age (${userAccountAge} | ${requiredAccountAge}).`);
      
      const wikiPageName = "contest-vote/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `⚠️ ${CurrentCETDateTime()} - u/${voter?.username} attempted to vote for [this post](https://reddit.com${post.permalink}) by u/${post.authorName}. **Reason**: LOW_ACC_AGE\n\n\n`;
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
      };

    const reasonD = `[LOW_ACC_AGE](https://www.reddit.com/r/${subreddit.name}/w/contest-vote/#wiki_error_codes)`;

    unsuccessMessage += `Reason: ${reasonD}\n\n`;
    unsuccessMessage += `~ r/${subreddit.name} Mod Team\n\n\n`;

    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: voter?.username,
      subject: `Unsuccessful voting`,
      text: unsuccessMessage
    })
        
      console.log(`u/${voter?.username} doesn't have enough old account (${userAccountAge} | ${requiredAccountAge}).`);
      return context.ui.showToast("Your account is too young, sorry!"); 
      }
      else {
        console.log(`u/${voter?.username} has enough old account (${userAccountAge} | ${requiredAccountAge}), okay.`);
    
    if (voterArray.includes(voter?.username)){
      console.log(`u/${voter?.username} has already voted.`);
      
      const wikiPageName = "contest-vote/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `⚠️ ${CurrentCETDateTime()} - u/${voter?.username} attempted to vote for [this post](https://reddit.com${post.permalink}) by u/${post.authorName}. **Reason**: ALREADY_VOTED\n\n\n`;
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
      };

      const reasonD = `[ALREADY_VOTED](https://www.reddit.com/r/${subreddit.name}/w/contest-vote/#wiki_error_codes)`;

    unsuccessMessage += `Reason: ${reasonD}\n\n`;
    unsuccessMessage += `~ r/${subreddit.name} Mod Team\n\n\n`;

    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: voter?.username,
      subject: `Unsuccessful voting`,
      text: unsuccessMessage
    })

      console.log(`u/${voter?.username} has already voted.`);
      return context.ui.showToast("You have already voted!");

    } else {

      console.log(`First check completed, u/${voter?.username} hasn't voted yet.`);
    if (postFlair == contestFlairID) {

      const wikiPageName = "contest-vote/votes";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `${CurrentCETDateTime()} - u/${voter?.username} successfully voted for [this post](https://reddit.com${post.permalink}) by u/${post.authorName}.\n\n\n`;
      pageContents += `---\n\n`;

      const wikiPageOptions = {
        subredditName: subreddit.name,
        page: wikiPageName,
        content: pageContents,
        reason: "Votes updated",
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
    };
    const wikiPageName2 = "contest-vote/logs";
      let wikiPage2: WikiPage | undefined;
    try {
        wikiPage2 = await context.reddit.getWikiPage(subreddit.name, wikiPageName2);
    } catch {
        //
    }

    var pageContents2 = `${wikiPage2?.content}\n\n`;
      pageContents2 += `✅ ${CurrentCETDateTime()} - u/${voter?.username} succesfully voted for [this post](https://reddit.com${post.permalink}) by u/${post.authorName}.\n\n\n`;
      pageContents2 += `---\n\n`;

      const wikiPageOptions2 = {
        subredditName: subreddit.name,
        page: wikiPageName2,
        content: pageContents2,
        reason: "Logs updated",
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
      };

    context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: voter!.username,
      subject: 'Vote confirmation',
      text: successMessage
    });
    voterArray.push(voter?.username);
    await context.redis.set(key, JSON.stringify(voterArray));
    return context.ui.showToast("Your vote has been recorded. Thanks for participation!");


    } else {

      console.log(`u/${voter?.username} tried to vote on non-contest post.`);
      
      const wikiPageName = "contest-vote/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `❗ ${CurrentCETDateTime()} - u/${voter?.username} attempted to vote for [this post](https://reddit.com${post.permalink}) by u/${post.authorName}. **Reason**: NOT_CONTEST_POST\n\n\n`;
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
      };

      const reasonD = `[\NOT_CONTEST_POST](https://www.reddit.com/r/${subreddit.name}/w/contest-vote/#wiki_error_codes)`;

    unsuccessMessage += `Reason: ${reasonD}\n\n`;
    unsuccessMessage += `~ r/${subreddit.name} Mod Team\n\n\n`;

    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: voter?.username,
      subject: `Unsuccessful voting`,
      text: unsuccessMessage
    })
      console.log(`u/${voter?.username} tried to vote on the non-contest post.`);
      return context.ui.showToast("Sorry, this post is not a contest post!");
    }
  };
}
    }
}   
  },
});

const removeUser = Devvit.createForm(
  {
    title: 'User removal from database',
    fields: [
      {
        name: 'username',
        label: 'Username?',
        type: 'string',
      },
      {
        name: 'note',
        label: 'Note',
        type: 'string',
      }
    ],
  },
  async (_event, context) => {
  const { reddit, ui } = context;
  const subreddit = await context.reddit.getCurrentSubreddit();

  const currentUser = await context.reddit.getCurrentUser();

  const userToRemove = _event.values.username;
  const note = _event.values.note;

  if (!userToRemove){
    return context.ui.showToast("No user found!");
  };

  const voter = await context.reddit.getUserByUsername(userToRemove);

    if (!voter){
      return console.log("No voter found!");
    };

    function CurrentCETDateTime(): string {
      const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
      return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
  } 
  
      // Retrieve all keys matching the voting pattern

      const key = `votes`;

      // Retrieve the list of voters
      const voters = await context.redis.get(key);
      const voterArray: string[] = voters ? JSON.parse(voters) : [];
  
      // Check if the user exists in the list
      if (!voterArray.includes(voter?.username)) {
        console.log(`u/${voter.username} has not voted yet!`);
        return context.ui.showToast(`u/${voter.username} has not voted yet!`);
      }
      else {
  
      // Remove the user from the array
      const updatedVoterArray = voterArray.filter(voterId => voterId !== voter.username);
      await context.redis.set(key, JSON.stringify(updatedVoterArray));  

      const wikiPageName = "contest-vote/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    if(!note){
      var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `🛑 ${CurrentCETDateTime()} - u/${currentUser?.username} removed u/${voter.username}'s vote.\n\n\n`;
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
      };

      console.log(`u/${voter.username} has been removed from the voters list!`);
      return context.ui.showToast(`u/${voter.username} has been removed from the voters list!`);
      } else {

    var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `🛑 ${CurrentCETDateTime()} - u/${currentUser?.username} removed u/${voter.username}'s vote. **Note**: ${note}\n\n\n`;
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
      };

      var removalMsg = `Hello u/${voter?.username},\n\n`;
      removalMsg += `We wanted to inform you that your vote has been removed by the moderators.\n\n`,
      removalMsg += `If you believe this action was taken in error, please reply to this message.\n\n`,
      removalMsg += `Thank you for your understanding.\n\n`,
      removalMsg += `~ r/${subreddit.name} Mod Team\n\n\n`;

      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: voter.username,
        subject: `Your vote has been removed`,
        text: removalMsg
      })

      console.log(`u/${voter.username} has been removed from the voters list!`);
      return context.ui.showToast(`u/${voter.username} has been removed from the voters list!`);
      };
    }
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    forUserType: 'moderator',
    label: '[Contest Vote] Show all users from database',
    onPress: async (event, context) => {

    const currentUser = await context.reddit.getCurrentUser();

    if (!currentUser) {
      return context.ui.showToast("No voter!");
      }
  
    const key = `votes`;

    // Retrieve the list of voters
    const voters = await context.redis.get(key);
    if (!voters) {
    return context.ui.showToast("No voters!");
    }

    const voterArray: string[] = JSON.parse(voters); // Parse the voters string into an array
    const txtVotes = voterArray.join(', '); // Convert list of voters to a string
    console.log('Current voters:', txtVotes);

    var textMsg = `Hey ${currentUser.username},\n\n`;

    textMsg += `Here is the list of all voters:\n\n`;

    textMsg += `${txtVotes}\n\n`;

    await context.reddit.sendPrivateMessage({
      to: currentUser?.username,
      subject: "List",
      text: textMsg
    });

    return context.ui.showToast("Sent!");
  }
  });

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: '[Contest Vote] Remove User from database',
  onPress: async (event, context) => {

    context.ui.showForm(removeUser);
  }
});

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: '[Contest Vote] Remove all users from database',
  onPress: async (event, context) => {

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentUser = await context.reddit.getCurrentUser();


    const key = `votes`;

    function CurrentCETDateTime(): string {
      const cetTime = new Date(Date.now() + 1 * 60 * 60000); // CET is UTC+1
      return cetTime.toISOString().slice(0, 19).replace('T', ' ') + ' CET';
  }

    // Clear all votes by deleting the key
    await context.redis.del(key);

    const wikiPageName = "contest-vote/logs";
      let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

     var pageContents = `${wikiPage?.content}\n\n`;
      pageContents += `🛑 ${CurrentCETDateTime()} - u/${currentUser?.username} cleared all votes. All votes were removed, and voting will restart from scratch.\n\n\n`;
      pageContents += `---\n\n`;

      const wikiPageOptions = {
        subredditName: subreddit.name,
        page: wikiPageName,
        content: pageContents,
        reason: "All votes cleared",
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
      };
    console.log('All votes have been cleared.');
    return context.ui.showToast("All votes have been cleared!");
}

});

export default Devvit;
