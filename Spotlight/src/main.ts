import { Comment } from '@devvit/protos';
import { Devvit} from '@devvit/public-api';
import {isModerator, submitPostReply, setLockByPostId, isBanned} from "devvit-helpers";

Devvit.configure({
  redditAPI: true, // Enable access to Reddit API
  modLog: false
});

export enum SettingName{
  LegitUsers = "legitUsers",
};

Devvit.addSettings([
  {
    name: SettingName.LegitUsers,
    type: "string",
    label: "List of legit users who can use the app",
  }
]);

const spotlightForOP = Devvit.createForm(
  {
    title: 'In case your post may not be on-topic, please add a public reason for approval.',
    fields: [
      {
        name: 'theReason',
        label: 'The reason why the post should be visible on the subreddit',
        type: 'string',
      },
    ],
  },
  async (_event, context) => {
  const { reddit, ui } = context;
  const subreddit = await context.reddit.getCurrentSubreddit();
  const originalPost = context.postId!;
  const approveReason = _event.values.theReason;
  const postAuthor = (await context.reddit.getPostById(originalPost)).authorName;
  const modName = await context.reddit.getCurrentUser();
  const appUser = await context.reddit.getCurrentUser();

  if (!approveReason){

    return ui.showToast("You must provide a reason. Please try again!");
}
else {

  var commentT = `Hello everyone!\n\n`;
  commentT += `This post may be off-topic, but u/${postAuthor} has wrote the following reason why this post should be visible:\n\n`;
  commentT += `> ${approveReason}\n\n`;

 const apprComment = await context.reddit.submitComment({
    id: originalPost, 
    text: commentT,
 });

  apprComment.distinguish(true);
  apprComment.lock();

  ui.showToast(`Posted!`);

  await context.reddit.addModNote({
    subreddit: subreddit.name,
    user: postAuthor,
    label: 'SPAM_WARNING',
    redditId: originalPost,
    note: `Reason provided.`
  })
  
}}
);

const spotlightForOA = Devvit.createForm(
  {
    title: 'Please write a comment that should be stickied.',
    fields: [
      {
        name: 'theComment',
        label: 'Your comment',
        type: 'string',
      },
    ],
  },
  async (_event, context) => {
  const { reddit, ui } = context;
  const subreddit = await context.reddit.getCurrentSubreddit();
  const originalPost = context.postId!;
  const spotComment = _event.values.theComment;
  const postAuthor = (await context.reddit.getPostById(originalPost)).authorName;
  const modName = await context.reddit.getCurrentUser();
  const appUser = await context.reddit.getCurrentUser();

  if (!spotComment){

    return ui.showToast("You must write something. Please try again!");
}
else {

  var commentT = `Hello, this is answer from u/${appUser?.username}!\n\n`;
  commentT += `> ${spotComment}\n\n`;
  commentT += `You can also contact them [here](https://reddit.com/message/compose?to=${appUser?.username}&subject=Contact&message=Text%3A)!\n\n`;

 const rComment = await context.reddit.submitComment({
    id: originalPost, 
    text: commentT,
 });

  rComment.distinguish(true);
  ui.showToast(`Posted!`);

  await context.reddit.addModNote({
    subreddit: subreddit.name,
    user: postAuthor,
    label: 'HELPFUL_USER',
    redditId: rComment.id,
    note: `Spotlight used.`
  })
  
}}
);

Devvit.addMenuItem({
location: 'post',
label: 'Spotlight',
description: 'Create a pinned comment by using Spotlight',
onPress: async (_event, context) => {
  const { ui } = context;

  const subreddit = await context.reddit.getCurrentSubreddit();
  const originalPost = context.postId!;
  const postAuthor = (await context.reddit.getPostById(originalPost)).authorName;
  const appUser = await context.reddit.getCurrentUser();


  const spotlighter = await context.reddit.getCurrentUser();

  if (!spotlighter){
    return ui.showToast("Spotlighter not found!");
  }

    const settings = await context.settings.getAll();

    const legitUserSetting = settings[SettingName.LegitUsers] as string ?? "";
    const legitUsers = legitUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (postAuthor == appUser?.username) {
      console.log(`${appUser.username} is an OP, okay.`);
      ui.showForm(spotlightForOP);
      } else {
        if (legitUsers.indexOf(spotlighter?.username.toLowerCase()) !== -1) {
          console.log(`${spotlighter?.username} is a legit user, okay.`);
          ui.showForm(spotlightForOA);
        }
        else {
        console.log(`${appUser?.username} is not allowed to do this.`);
        return ui.showToast("Sorry, you are not allowed to do this!");
        };
      };
  
}
});


Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) {
  
    console.log(`App installed on r/${event.subreddit?.name} by ${event.installer?.name}.`);

    const subreddit = await context.reddit.getCurrentSubreddit();

    var firstMsg = `Hello r/${subreddit.name} mods,\n\n`;
    
    firstMsg += `Thanks for installing Spotlight!\n\n`,
    
    firstMsg += `This intuitive tool allows your legit users and OPs to pin their comments.\n\n`,

    firstMsg += `Users can write comments through a simple form and mods are able to pin user's comments by clicking "Pin that comment".\n\n`,
    
    firstMsg += `You can set a list of legit users here [here](https://developers.reddit.com/r/${subreddit.name}/apps/spotlight-app).\n\n`,
    
    firstMsg += `[Instructions](https://www.reddit.com/r/paskapps/comments/1f8cmde/introducing_spotlight_an_app_that_allows_op_and/) | [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=Spotlight&message=Text%3A%20)\n\n\n`

    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: 'spotlight-app',
      subject: `Thanks for installing Spotlight!`,
      text: firstMsg
    })
}
}
); 

const editFormOP = Devvit.createForm(
  (data) => ({
    fields: [
      {
        name: `nBody`,
        label: 'Comment',
        type: 'paragraph',
        defaultValue: data.pBody,
        required: true,
      },
    ],
    title: 'Edit comment',
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  }),
  async (event, context) => {
    console.log(event.values);
    const subreddit = await context.reddit.getCurrentSubreddit();
    const appAccount = (await context.reddit.getAppUser()).username;
    const originalPost = context.postId!;
    const getPost = await context.reddit.getPostById(originalPost);

    var newComment = event.values.nBody;

    getPost.edit({text: newComment});
    context.ui.showToast('Edited!');

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: appAccount,
      label: 'HELPFUL_USER',
      note: `${appAccount} edited post`,
      redditId: originalPost
    });
});

const editFormOA = Devvit.createForm(
  (data) => ({
    fields: [
      {
        name: `nBody`,
        label: 'Comment',
        type: 'paragraph',
        required: true,
        defaultValue: data.pBody,
      },
    ],
    title: 'Edit comment',
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  }),
  async (event, context) => {
    console.log(event.values);
    const subreddit = await context.reddit.getCurrentSubreddit();
    const appAccount = (await context.reddit.getAppUser()).username;
    const edComment = context.commentId!;
    const originalPost = (await context.reddit.getCommentById(edComment))?.postId;
    const getComment = (await context.reddit.getCommentById(edComment));


    var newComment = `Hello, this is answer from u/${appAccount}!\n\n`;
    newComment += `> ${event.values.nBody}\n\n`;
    newComment += `You can also contact them [here](https://reddit.com/message/compose?to=${appAccount}&subject=Contact&message=Text%3A)!\n\n`;

    getComment.edit({text: newComment});
    context.ui.showToast('Edited!');

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: appAccount,
      label: 'HELPFUL_USER',
      note: `${appAccount} edited post`,
      redditId: getComment?.id
    });
});

/* Devvit.addMenuItem({
  location: ['comment'],
  label: 'Spotlight (Dashboard)',
  onPress: async (event, context) => {
    const { reddit, ui } = context;
    const { location } = event;

  const subreddit = await context.reddit.getCurrentSubreddit();
  const thisComment = context.commentId!;
  const getComment = await context.reddit.getCommentById(thisComment);
  const originalPost = (await context.reddit.getCommentById(thisComment))?.postId;
  const postAuthor = (await context.reddit.getPostById(originalPost)).authorName;
  const appUser = await context.reddit.getCurrentUser();


  const spotlighter = await context.reddit.getCurrentUser();

  if (!spotlighter){
    return ui.showToast("Spotlighter not found!");
  };

    const settings = await context.settings.getAll();

    const legitUserSetting = settings[SettingName.LegitUsers] as string ?? "";
    const legitUsers = legitUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (postAuthor == appUser?.username) {
      console.log(`${appUser.username} is an OP, okay.`);
      ui.showForm(editFormOP, { pBody: getComment.body });
      } else {
        if (legitUsers.indexOf(spotlighter?.username.toLowerCase()) !== -1) {
          console.log(`${spotlighter?.username} is a legit user, okay.`);
          ui.showForm(editFormOA, { pBody: getComment.body });
        }
        else {
        console.log(`${appUser?.username} is not allowed to do this.`);
        return ui.showToast("Sorry, you are not allowed to do this!");
        };
      };

  }
}); */

Devvit.addMenuItem({
  location: ['comment'],
  forUserType: 'moderator',
  label: '[Spotlight] - Delete content',
  description: 'Delete content created by Spotlight',
  onPress: async (event, context) => {
    const { reddit, ui } = context;
    const { location } = event;
    const subreddit = await context.reddit.getCurrentSubreddit();

    const appUser = context.reddit.getAppUser();
    const currentUser = await context.reddit.getCurrentUser();
    const perms = await currentUser?.getModPermissionsForSubreddit(subreddit.name);


    if ((location === 'comment') && perms?.includes('posts') || perms?.includes('all')){
  
    if ((await context.reddit.getCommentById(context.commentId!)).authorName == (await appUser).username)
    {
      (await context.reddit.getCommentById(context.commentId!)).delete(); 
      console.log(`Spotlight content deleted by ${currentUser?.username}.`);
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

const pinThatComment = Devvit.createForm(
    {
      title: 'Pin that comment',
      fields: [
        {
          name: 'modNote',
          label: 'Note',
          helpText: 'Optional',
          type: 'string',
        },
      ],
    },
    async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await context.reddit.getCurrentSubreddit();
    const originalComment = await context.commentId!;
    const modName = await context.reddit.getCurrentUser();
    const originalPost = (await context.reddit.getCommentById(originalComment))?.postId;
    const commentAuthor = (await context.reddit.getCommentById(originalComment)).authorName;
    const commentLink = (await context.reddit.getCommentById(originalComment)).permalink;
    const commentText = (await context.reddit.getCommentById(originalComment)).body;
    const pinNote = _event.values.modNote;


    if (!pinNote){

      var pinnedComment = `Mods have pinned the [comment](https://reddit.com${commentLink}) by ${commentAuthor}:\n\n`;
      pinnedComment += `> ${commentText}\n\n`;


    const newCom = await context.reddit.submitComment({
      id: originalPost, 
      text: pinnedComment});

    newCom.distinguish(true);
    newCom.lock();
    submitPostReply
    ui.showToast(`Posted!`);

    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: commentAuthor,
      label: 'HELPFUL_USER',
      note: `Comment pinned by ${modName?.username}.`,
      redditId: originalComment
    });

    await context.modLog
        .add({
          action: 'sticky',
          target: pinnedComment,
          details: `Pinned by ${modName}.`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${originalPost}.`, e.message)
        );
  }
  else {
    var pinnedComment = `Mods have pinned the [comment](https://reddit.com${commentLink}) by ${commentAuthor}:\n\n`;
    pinnedComment += `> ${commentText}\n\n`;
    pinnedComment += `Pin reason: ${pinNote}\n\n`;

    const newCom = await context.reddit.submitComment({
      id: originalPost, 
      text: pinnedComment });

    newCom.distinguish(true);
    newCom.lock();

    ui.showToast(`Posted!`);
    await context.modLog
        .add({
          action: 'sticky',
          target: pinnedComment,
          details: `Comment pinned by mod`,
        })
        .catch((e: any) =>
          console.error(`Failed to add modlog for: ${originalPost}.`, e.message)
        );
    };

    
  }    
);

Devvit.addMenuItem({
  location: 'comment',
  forUserType: 'moderator',
  label: '[Spotlight] - Pin this comment',
  description: 'Pin the comment by using Spotlight',
  onPress: async (_event, context) => {
    const { ui } = context;
    ui.showForm(pinThatComment);

  }
});


export default Devvit;
