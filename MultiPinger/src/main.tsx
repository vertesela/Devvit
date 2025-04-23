import {
  Devvit,
  MenuItemOnPressEvent,
  ModMailTrigger,
  ModMailConversationState,
  RedditAPIClient,
  ModAction,
  ModNote,
  ConversationUserData,
  Subreddit,
  ModMailActionType,
  PrivateMessage,
  WithUserData,
  ConversationResponse,
  ModMailService,
  AddRemovalNoteOptions,
  RemovalReason,
  MenuItemUserType,
  MenuItemLocation,
  MenuItem,
  TriggerContext,
  OnTriggerRequest,
  Comment,
  getModerationLog,
  FormOnSubmitEvent,
  Post,
  User,
  TriggerEvent
} from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
});

Devvit.addSettings([
  {
    type: 'boolean',
    name: 'allPerms',
    label: 'Require full permissions for app use?',
    helpText: `If true, only mods with full permissions can use the app. `,
    defaultValue: false
  },
  {
    type: 'boolean',
    name: 'autoArchive',
    label: 'Auto-archive app messages?',
    helpText: `If true, app will automatically archive app-messages. `,
    defaultValue: true,
  },
]);

Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) {
  
    console.log(`App installed on r/${event.subreddit?.name} by ${event.installer?.name}.`);

    const subreddit = await context.reddit.getCurrentSubreddit();

    var firstMsg = `Hello u/${event.installer?.name},\n\n`;
    
    firstMsg += `Thanks for installing MultiPinger!\n\n`,
    
    firstMsg += `This app allows you to send a message to more users at once.\n\n`,

    firstMsg += `To use this app, you must have *Mail* permissions, but you can require all permissions to use the app (you can configure it [here](https://developers.reddit.com/r/${subreddit.name}/apps/MultiPinger)).\n\n`;

    firstMsg += `Please don't use this app for spam.\n\n`,

    firstMsg += `If you need any help, contact the dev [here](https://reddit.com/message/compose?to=/r/paskapps&subject=MultiPinger&message=Text%3A%20)\n\n\n`

    await context.reddit.sendPrivateMessage({
      to: `${event.installer?.name}`,
      subject: `Thanks for installing MultiPinger!`,
      text: firstMsg
    })
}
}
); 

const mstForm = Devvit.createForm(
  {
    title: 'MultiPinger',
    description: `MultiPinger is an app which can send a message to more users at once. Please don't use it for spam!`,
    fields: [
      {
        name: `userA`,
        label: 'User(s)',
        type: 'string',
        required: true,
      },
      {
        name: `subjectMM`,
        label: 'Subject',
        type: 'string',
        required: true,
      },
      {
        name: `textMM`,
        label: 'Message',
        helpText: `Write something here.`,
        type: 'paragraph',
        required: true,
      },
      {
        name: `displayModName`,
        label: `Anonymous`,
        helpText: `If false, your username will be included at the end of the message.`,
        type: 'boolean',
        defaultValue: true,
      }
    ],
    acceptLabel: 'Send',
    cancelLabel: 'Cancel',
  },
  async (_event, context) => {
    const { reddit, ui } = context;    
    const author = _event.values.userA;
    const subreddit = await reddit.getCurrentSubreddit();
    const currentUser = await reddit.getCurrentUser();
    const showModName = _event.values.displayModName;
    const subjectText = _event.values.subjectMM;
    var messageText = `${_event.values.textMM}\n\n`;

    if (!showModName){
      messageText += `~ u/${currentUser?.username}\n\n`;
    } else {
      console.log("Sending anonymously...");
    };


    const usernames = author.split(',').map((username: string) => username.trim());

  const result = `Message sent to user(s) ${author}.`;
  
  for (const username of usernames) {
    await reddit.sendPrivateMessageAsSubreddit(
    {
      fromSubredditName: subreddit.name,
      to: username,
      subject: subjectText,
      text: messageText,
    },
    );
  }
  console.log(`${currentUser?.username} has sent a message to user(s) ${author}.`);
  ui.showToast(result);
  }
);

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'MultiPinger',
  description: 'Send a message to multiple users at once.',
  onPress: async (_event, context) => {
    const { ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const appUser = await context.reddit.getCurrentUser();
    const perms = await appUser?.getModPermissionsForSubreddit(subreddit.name);
    const fullPermsRequirement = await context.settings.get<boolean>(('allPerms'));
   

    if (!fullPermsRequirement){
      console.log("No full permissions requirement!"); 
      if (perms?.includes('mail') || perms?.includes('all')){
    console.log(`${appUser?.username} has needed permissions (${perms}), ok!`);
    context.ui.showForm(mstForm);
      } else {
        console.log(`${appUser?.username} has no permissions (${perms})!`);
        return ui.showToast(`You don't have the necessary permissions.`);
      };
    } else if (fullPermsRequirement && perms?.includes('all')) {
      console.log("Full permissions required!"); 
      console.log(`${appUser?.username} has full permissions (${perms}), ok!`);
      context.ui.showForm(mstForm);
    } else {
      console.log(`${appUser?.username} has no permissions (${perms})!`);
      return ui.showToast(`You don't have the necessary permissions.`);
    }
  }
},);

Devvit.addTrigger({
  event: 'ModMail',
  async onEvent(event, context) {
  
    const autoArchiving = await context.settings.get<boolean>(('autoArchive'));

    if (!autoArchiving){
      console.log("Subreddit has disabled auto-archiving app messages.");
    }
    else {
      console.log("Subreddit has enabled (default setting) auto-archiving app messages.");
    try {
    if (event.messageAuthor?.name.includes('multipinger')) {
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
}
);

export default Devvit;
