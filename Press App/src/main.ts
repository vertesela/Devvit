import { Devvit, FormOnSubmitEvent, MenuItemOnPressEvent } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true, // Enable access to the Reddit API
  modLog: false,
  http: true,
});

Devvit.addSettings([
  {
    type: 'boolean',
    name: 'sendModmail',
    label: 'Send to Modmail?',
    helpText: `Choose this if you'd like to receive notification in Modmail.`,
    defaultValue: true
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
        helpText: `Choose this if you'd like to receive notification on the Discord server.`
      },
      {
        type: 'string',
        name: 'webhookEditor',
        label: 'Webhook URL',
      },
      {
        type: 'string',
        name: 'discordRole',
        label: 'Role ID to ping',
      },
    ]
  },
]);

Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) {
  
    console.log(`App installed on r/${event.subreddit?.name} by ${event.installer?.name}.`);

    const subreddit = await context.reddit.getCurrentSubreddit();

    var firstMsg = `Hello r/${subreddit.name} mods,\n\n`;
    
    firstMsg += `Thanks for installing Press App!\n\n`,
    
    firstMsg += `This intuitive tool allows you to easily publish and edit mod posts.\n\n`,

    firstMsg += `One mod can compose a post through this app, and then another can easily edit it. To use this app, you must have *Post* or *Everything* permissions.\n\n`;

    firstMsg += `Also, Press App supports Discord integration (you can configure it [here](https://developers.reddit.com/r/${subreddit.name}/apps/press-app)), you can set to receive notifications after each edit.\n\n`,
        
    firstMsg += `[Terms & conditions](https://www.reddit.com/r/paskapps/wiki/press-app/terms-and-conditions/) | [Privacy Policy](https://www.reddit.com/r/paskapps/wiki/press-app/privacy-policy/) | [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=PressApp%20App&message=Text%3A%20)\n\n\n`

    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: 'press-app',
      subject: `Thanks for installing Press App!`,
      text: firstMsg
    })
}
}
); 


const submitForm = Devvit.createForm(
  {
      title: 'Submit a post',
      fields: [
        {
          name: `titleOB`,
          label: 'Post title',
          type: 'string',
          required: true,
        },
        {
          name: `bodyP`,
          label: 'Body',
          type: 'paragraph',
          required: true,
        },
      ],
      acceptLabel: 'Post',
      description: 'This is a form for submitting a post through mod press app. You can edit the post later.',
      cancelLabel: 'Cancel',
    },
    async (_event, context) => {
      const { reddit, ui } = context;    
      const subreddit = await reddit.getCurrentSubreddit();
      const appAccount = await reddit.getAppUser();
      const currentUser = await reddit.getCurrentUser();

      const postTitle = _event.values.titleOB;
      var postBody = _event.values.bodyP;

    
      ui.showToast("Posted!");

  });
  
Devvit.addMenuItem({
    location: 'subreddit',
    label: 'Submit mod post',
    description: 'A form for submitting a post through Press app. Post can be edited later.',
    forUserType: 'moderator',
    onPress: async (_event, context) => {
      const { ui } = context;

      const subreddit = await context.reddit.getCurrentSubreddit();
      const appUser = await context.reddit.getCurrentUser();
      const botAccount = (await context.reddit.getAppUser()).username;
      const perms = await appUser.getModPermissionsForSubreddit(subreddit.name);
   

    if ( perms.includes('posts') || perms.includes('all') ){
    console.log(`${appUser.username} has needed permissions (${perms}), ok!`);
    context.ui.showForm(submitForm);
    } else {
        console.log(`${appUser.username} doesn't have Posts permission (${perms}), not ok!`);
      return ui.showToast(`You don't have the necessary permissions.`);
    }
    },
});


const editForm = Devvit.createForm(
  (data) => ({
    fields: [
      {
        name: `nTitle`,
        label: 'Post title',
        type: 'string',
        defaultValue: data.pTitle,
        helpText: `Post title can't be edited.`,
        disabled: true
      },
      {
        name: `nBody`,
        label: 'Post body',
        type: 'paragraph',
        defaultValue: data.pBody,
        required: true,
      },
    {
      name: `reasonRevision`,
      label: 'Reason',
      type: 'string',
    },
    {
      name: `mybDist`,
      label: `Distinguish?`,
      type: 'boolean',
      defaultValue: data.statusDist,
    },
    {
      name: `iSticky`,
      label: `Sticky?`,
      type: 'boolean',
      defaultValue: data.statusSticky,
    }
    ],
    title: 'Edit post',
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  }),
  async (event, context) => {
    console.log(event.values);
    const subreddit = await context.reddit.getCurrentSubreddit();
    const appAccount = (await context.reddit.getAppUser()).username;
    const modEditor = (await context.reddit.getCurrentUser()).username;
    const originalPost = context.postId!;
    const getPost = await context.reddit.getPostById(originalPost);
    const img = event.values.imgBody;
    const distinguishPost = event.values.mybDist;
    const stickyPost = event.values.iSticky;

    const sendtoModmail = await context?.settings.get('sendModmail') as boolean;
    const sendtoDiscord = await context?.settings.get('sendDiscord') as boolean;

    const oldBody = getPost.body;

    var newPostBody = event.values.nBody;

    if (distinguishPost == false){
      console.log('Undistinguishing post...');
      getPost.undistinguish();
    } else {
      console.log('Distinguishing post...');
      getPost.distinguish();
    };

    if (stickyPost == false){
      console.log('Unstickying post...');
      getPost.unsticky();
    } else {
      console.log('Stickying post...');
      getPost.sticky();
    };

    const reasonRev = event.values.reasonRevision;
    getPost.edit({text: newPostBody});
    context.ui.showToast('Edited!');

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: appAccount,
      label: 'SOLID_CONTRIBUTOR',
      note: `${modEditor} edited mod post, reason: ${reasonRev}`,
      redditId: originalPost
    });

    /* await context.modLog
        .add({
          action: 'edit_scheduled_post',
          target: originalPost,
          details: `Edited mod post`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${originalPost}.`, e.message)
        ); */

    var logMsg = `Title: ${getPost.title}\n\n`;
    logMsg += `URL: https://reddit.com${getPost.permalink}\n\n`,
    logMsg += `Moderator: ${modEditor}\n\n`;
    logMsg += `Previous post body: ${oldBody}\n\n`;
    logMsg += `New post body: ${newPostBody}\n\n`;
    logMsg += `Reason for revision: ${reasonRev}\n\n`;
    
    if (sendtoModmail == false) {
      console.log("Not sending to Modmail, skipping...");
    } else {
    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: appAccount,
      subject: `Edited mod post`,
      text: logMsg
    });
  };

    const webhook = await context?.settings.get('webhookEditor') as string;

    console.log(`Received ModEdit trigger event:\n${JSON.stringify(event)}`);

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
        if (discordRole) {
            discordAlertMessage = `<@&${discordRole}>\n\n`;
        } else {
          discordAlertMessage = ``;
        };
      
        if (webhook.startsWith('https://discord.com/api/webhooks/')) {
          console.log("Got Discord webhook, let's go!");

   
         // Check if the webhook is a Discord webhook
         payload = {
          content: discordAlertMessage,
          embeds: [
{
  title: `${getPost.title}`,
  url: `https://reddit.com${getPost.permalink}`,
  fields: [
    {
      name: 'Subreddit',
      value: `r/${subreddit.name}`,
      inline: true,
    },
    {
      name: 'Moderator',
      value: `${modEditor}`,
      inline: true,
    },
    {
      name: 'Previous post body',
      value: `${oldBody}`,
      inline: true,
    },
    {
      name: 'New post body',
      value: `${newPostBody}`,
      inline: true,
    },
    {
      name: 'Reason',
      value: `${reasonRev}`,
      inline: true,
    },
    {
      name: 'Score',
      value: `${getPost.score}`,
      inline: true,
    },
  ],
},
],
}
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
    catch (err) {
      console.error(`Error sending alert: ${err}`);
    }
}
  });
 
  Devvit.addMenuItem({
    location: 'post',
    label: 'Edit post',
    description: 'A form for editing a post through Press App.',
    forUserType: 'moderator',
    onPress: async (_event, context) => {
      const { ui } = context;
  
      const subreddit = await context.reddit.getCurrentSubreddit();
      const originalPost = context.postId!;
      const getPost = await context.reddit.getPostById(originalPost);
      const postOP = getPost.authorName;
      const appUser = await context.reddit.getCurrentUser();
      
      const checkDist = getPost.isDistinguishedBy();
      const checkSt = getPost.isStickied();
  
      const postTitle = getPost.title;
    
  
  const botAccount = (await context.reddit.getAppUser()).username;

  const perms = await appUser.getModPermissionsForSubreddit(subreddit.name);
   
  
  if ((postOP == botAccount)) {
    console.log(`${postOP} = ${botAccount}, ok!`);
    if ( perms.includes('posts') || perms.includes('all') ){
    console.log(`${appUser.username} has needed permissions (${perms}), ok!`);
    context.ui.showForm(editForm, { userId: appUser, pTitle: getPost.title, pBody: getPost.body, statusDist: checkDist, statusSticky: checkSt });
    } else {
        console.log(`${appUser.username} doesn't have Posts permission (${perms}), not ok!`);
      return ui.showToast(`You don't have the necessary permissions.`);
    }
  }
  else {
    console.log(`${postOP} != ${botAccount}, not ok!`);
    return ui.showToast(`Sorry, this is not submission from ${botAccount}!`);
  };
    },
  });

  Devvit.addMenuItem({
    location: ['comment', 'post'],
    forUserType: 'moderator',
    label: 'Delete bot content',
    onPress: async (event, context) => {
      const { reddit, ui } = context;
      const { location } = event;
      const subreddit = await context.reddit.getCurrentSubreddit();

      const appUser = context.reddit.getAppUser();
      const currentUser = await context.reddit.getCurrentUser();
      const perms = await currentUser.getModPermissionsForSubreddit(subreddit.name);


      if ((location === 'post') && perms.includes('posts') || perms.includes('all') ){
        if ((await context.reddit.getPostById(context.postId!)).authorName == (await appUser).username)
          {
            (await context.reddit.getPostById(context.postId!)).delete(); 
            console.log(`Bot content deleted by ${currentUser.username}.`);
            return ui.showToast('Deleted!');
          }
          else {
            ui.showToast(`This is only for content removal by ${(await appUser).username}!`);
          };
      } else {
        ui.showToast(`You don't have the necessary permissions.`);
      };

      if ((location === 'comment') && perms.includes('posts') || perms.includes('all')){
    
      if ((await context.reddit.getCommentById(context.commentId!)).authorName == (await appUser).username)
      {
        (await context.reddit.getCommentById(context.commentId!)).delete(); 
        console.log(`Bot content deleted by ${currentUser.username}.`);
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


export default Devvit;
