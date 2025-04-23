import { Comment } from '@devvit/protos';
import { Devvit} from '@devvit/public-api';

Devvit.configure({
  redditAPI: true, // Enable access to Reddit API
});

Devvit.addSettings([{
  type: 'number',
  name: 'titleLen',
  label: 'Minimum length of new title',
  defaultValue: 5,
}
]);

const repostForm = Devvit.createForm(
{
    title: 'Repost form',
    fields: [
      {
        name: `titleOB`,
        helpText: `Please provide a better post title`,
        label: 'New post title',
        type: 'string',
        required: true,
      },
    ],
    acceptLabel: 'Repost',
    description: `If your post has a bad title, you can simply repost it by providing a better title in this form. Post body will remain unchanged, but you can edit it later.`
  },
  async (_event, context) => {
    const { reddit, ui } = context;    
    const subreddit = await reddit.getCurrentSubreddit();
    const originalPost = context.postId!;
    const getPost = await context.reddit.getPostById(originalPost);
    const postOP = getPost.authorName;
    const appReposter = (await context.reddit.getCurrentUser()).username;
    const postTitle = getPost.title;
    const newTitle = _event.values.titleOB;
    const oldPostBody = getPost.body!.split("\n\n").join("\n\n> ");
    const oldFlair = getPost.flair?.templateId;
    
    var newPostBody = `**Original post**: https://reddit.com${getPost.permalink}\n\n`;

    newPostBody += oldPostBody;

    const titleLength = await context.settings.get<number>(('titleLen'));


    if (!titleLength) {
      console.log("Minimum length of new title is undefined.");
      return;
    }

    if ((newTitle.length >= titleLength) && (oldFlair || !oldFlair)) {
      console.log(`${newTitle.length} >= ${titleLength}, ok`);
      await context.reddit.submitPost({subredditName: subreddit.name, title: newTitle, text: newPostBody, flairId: oldFlair });
      ui.showToast('Posted! Please refresh the feed.');

      } else {
        console.log(`${newTitle.length} < ${titleLength}, not ok`);
        return ui.showToast(`Make sure that your post contains at least ${titleLength} elements.`);
      }

    });

Devvit.addMenuItem({
  location: 'post',
  label: 'Repost (Title)',
  onPress: async (_, context) => {
    const { ui } = context;

    const subreddit = await context.reddit.getCurrentSubreddit();
    const originalPost = context.postId!;
    const getPost = await context.reddit.getPostById(originalPost);
    const postOP = getPost.authorName;
    const appReposter = (await context.reddit.getCurrentUser()).username;

    const bannedCheck = await context.reddit.getBannedUsers({
      subredditName: subreddit.name,
      username: postOP,
    }).all();
    const userIsBanned = bannedCheck.length > 0;


if ((postOP == appReposter)) {
  console.log(`${postOP} = ${appReposter}, ok!`);
  if (!userIsBanned){
  console.log(`${postOP} is not banned on r/${subreddit.name}, ok!`);
  context.ui.showForm(repostForm);
  } else {
      console.log(`${postOP} is banned on r/${subreddit.name}, not ok!`);
    return ui.showToast(`Sorry, you are banned.`);
  }
}
else {
  console.log(`${postOP} != ${appReposter}, not ok!`);
  return ui.showToast("Sorry, you are not an OP!");
};
  },
});


Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) {
  
    console.log(`App installed on r/${event.subreddit?.name} by ${event.installer?.name}.`);

    const subreddit = await context.reddit.getCurrentSubreddit();

    var firstMsg = `Hello r/${subreddit.name} mods,\n\n`;
    
    firstMsg += `Thanks for installing TitleTweaker!\n\n`,
    
    firstMsg += `This intuitive tool allows your users to easily refine their post titles.\n\n`,

    firstMsg += `Users can submit their revised title through a simple form, and the bot reposts it for them - quick, easy, and effective.\n\n`,
    
    firstMsg += `You can adjust the minimum title length rule [here](https://developers.reddit.com/r/${subreddit.name}/apps/title-tweaker). By default, the title must be 5 characters long, but you can change this at any time.\n\n`,
    
    firstMsg += `[Terms & conditions](https://www.reddit.com/r/paskapps/wiki/title-tweaker/terms-and-conditions/) | [Privacy Policy](https://www.reddit.com/r/paskapps/wiki/title-tweaker/privacy-policy/) | [Contact](https://reddit.com/message/compose?to=/r/paskapps&subject=TitleTweaker%20App&message=Text%3A%20)\n\n\n`

    await context.reddit.modMail.createConversation({
      body: firstMsg,
      isAuthorHidden: false,
      subredditName: subreddit.name,
      subject: `Thanks for installing TitleTweaker!`,
      to: null,
    })
}
}
); 

export default Devvit;
