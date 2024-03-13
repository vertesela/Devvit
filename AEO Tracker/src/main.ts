import {
  Devvit,
  MenuItemOnPressEvent,
  ModMailConversationState,
  RedditAPIClient,
  ModAction,
  ModNote,
  ConversationUserData,
  ModMailActionType,
  PrivateMessage,
  WithUserData,
  ConversationResponse,
  ModMailService,
  AddRemovalNoteOptions,
  MenuItemUserType,
  MenuItemLocation,
  MenuItem,
  Comment,
  getModerationLog
} from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
  modLog: true,
  realtime: true,
});

Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) { 

  const subreddit = await context.reddit.getCurrentSubreddit();

  var firstMsg = `Hello r/${subreddit.name},\n\n`;

  firstMsg += `Thanks for installing AEO tracker!\n\n`,

  firstMsg += `This app will alert you whenever AEO actions require attention. It includes context (title, body, URL) and a link to ModSupport for quick action.\n\n`,

  firstMsg += `If you have any questions, please contact u/paskatulas (app developer).\n\n`,

    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: 'aeo-tracker',
      subject: `First message`,
      text: firstMsg
    })

  }});

Devvit.addTrigger({
  event: 'ModAction',
  async onEvent(event, context) {

  const subreddit = await context.reddit.getCurrentSubreddit();
  
    try {

    let commentAction = await context.reddit.getModerationLog({
      subredditName: subreddit.name,
      moderatorUsernames: ['a'],
      type: 'removecomment',
      limit: 1, // or whatever
  }).all();

  let postAction = await context.reddit.getModerationLog({
    subredditName: subreddit.name,
    moderatorUsernames: ['a'],
    type: 'removelink',
    limit: 1, // or whatever
}).all();

  const targC = commentAction.map(entry => ({
    action: entry.type,
    mod: entry.moderatorName,
    targetUser: entry.target?.author,
    targetBody: entry.target?.body,
    targetURL: entry.target?.permalink,
    createdAt: new Date(entry.createdAt.getUTCDate() * 1000), // Convert Unix timestamp to JavaScript Date object 
  }
  ));

  const targP = postAction.map(entry => ({
    action: entry.type,
    mod: entry.moderatorName,
    targetUser: entry.target?.author,
    targetPost: entry.target?.title,
    targetBody: entry.target?.body,
    targetURL: entry.target?.permalink,
    createdAt: new Date(entry.createdAt.getUTCDate() * 1000), // Convert Unix timestamp to JavaScript Date object 
  }
  ));

  targC.forEach(async (element, index) => {
    console.log(`Element ${index + 1}: ${element.action}`);

  console.log(`Received ModAction trigger event:\n${JSON.stringify(event)}`);

  var comText = `Target user: u/${targC[0].targetUser}\n\n`;

  comText += `Removed content:\n\n`;

  comText += `> ${targC[0].targetBody}\n\n`;

  comText += `Link: https://reddit.com${targC[0].targetURL}\n\n`;

  comText += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;

  comText += `Also, if you think I made a mistake, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;

  await context.reddit.sendPrivateMessageAsSubreddit({
    fromSubredditName: subreddit.name,
    to: 'aeo-tracker',
    subject: `Alert - comment removal by AEO`,
    text: comText,
  })
});

targP.forEach(async (element, index) => {
  console.log(`Element ${index + 1}: ${element.action}`);

console.log(`Received ModAction trigger event:\n${JSON.stringify(event)}`);

var pText = `Target user: u/${targP[0].targetUser}\n\n`;

pText += `Removed content:\n\n`;

pText += `> ${targP[0].targetPost}\n\n`;

pText += `> ${targP[0].targetBody}\n\n`;

pText += `Link: https://reddit.com${targP[0].targetURL}\n\n`;

pText += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;

pText += `Also, if you think I made a mistake, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;

await context.reddit.sendPrivateMessageAsSubreddit({
  fromSubredditName: subreddit.name,
  to: 'aeo-tracker',
  subject: `Alert - post removal by AEO`,
  text: pText,
})
});

} catch(error){
console.error('Error getting mod logs:', error);
}
}
}
);



export default Devvit;