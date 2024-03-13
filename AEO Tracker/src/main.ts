import { ModAction } from '@devvit/protos';
import {
  Devvit,
  MenuItemOnPressEvent,
  ModMailConversationState,
  RedditAPIClient,
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
  getModerationLog,
} from '@devvit/public-api';
import { ModLogClient } from '@devvit/public-api/apis/modLog/ModLogClient.js';

import {isModerator} from "devvit-helpers";

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
      if (event.moderator.name.includes("paskatulas")) {

      console.log('Found action by paskatulas...')

      console.log(`Received ModAction trigger event:\n${JSON.stringify(event)}`);

      var comText = `Target user: u/${event.targetUser?.name}\n\n`;
    
      comText += `Removed content:\n\n`;
    
      comText += `> ${event.targetComment?.body}\n\n`;
    
      comText += `Link: https://reddit.com${event.targetComment?.permalink}\n\n`;
    
      comText += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;
    
      comText += `Also, if you think I made a mistake, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;
    
      await context.reddit.sendPrivateMessageAsSubreddit({
        fromSubredditName: subreddit.name,
        to: 'aeo-tracker',
        subject: `Alert - comment removal by AEO`,
        text: comText,
      })
    
    console.log(`Received ModAction trigger event:\n${JSON.stringify(event)}`);
    
    var pText = `Target user: u/${event.targetUser?.name}\n\n`;
    
    pText += `Removed content:\n\n`;
    
    pText += `> ${event.targetPost?.title}\n\n`;
    
    pText += `> ${event.targetPost?.selftext}\n\n`;
    
    pText += `Link: https://reddit.com${event.targetPost?.permalink}\n\n`;
    
    pText += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;
    
    pText += `Also, if you think I made a mistake, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;
    
    await context.reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: 'aeo-tracker',
      subject: `Alert - post removal by AEO`,
      text: pText,
    })
        // Skip actions by AutoModerator
        return;
    }
    // I'm using isModerator from devvit-helpers, but you can define your own function
    if (await isModerator(context.reddit, subreddit.name, event.moderator.name)) {
        // Skip actions by moderators
        return;
    } else {
        // This action was performed by a non-moderator, so most likely an admin

  console.log(`Received ModAction trigger event:\n${JSON.stringify(event)}`);

  var comText = `Target user: u/${event.targetUser?.name}\n\n`;

  comText += `Removed content:\n\n`;

  comText += `> ${event.targetComment?.body}\n\n`;

  comText += `Link: https://reddit.com${event.targetComment?.permalink}\n\n`;

  comText += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;

  comText += `Also, if you think I made a mistake, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;

  await context.reddit.sendPrivateMessageAsSubreddit({
    fromSubredditName: subreddit.name,
    to: 'aeo-tracker',
    subject: `Alert - comment removal by AEO`,
    text: comText,
  })

console.log(`Received ModAction trigger event:\n${JSON.stringify(event)}`);

var pText = `Target user: u/${event.targetUser?.name}\n\n`;

pText += `Removed content:\n\n`;

pText += `> ${event.targetPost?.title}\n\n`;

pText += `> ${event.targetPost?.selftext}\n\n`;

pText += `Link: https://reddit.com${event.targetPost?.permalink}\n\n`;

pText += `Please check more details [here](https://www.reddit.com/r/${subreddit.name}/about/log?subredditName=${subreddit.name}&moderatorNames=a) and if you think that this was a mistake, you can contact Reddit admins [here](https://www.reddit.com/message/compose?to=%2Fr%2FModSupport&subject=Review+a+Safety+action&message=Permalink+to+Report+Response%3A%0A%0AAny+additional+context%3A).\n\n\n`;

pText += `Also, if you think I made a mistake, please contact the developer [here](https://reddit.com/message/compose?to=paskatulas&subject=Bug%20Report&message=Text%3A%20). Thank you!\n\n`;

await context.reddit.sendPrivateMessageAsSubreddit({
  fromSubredditName: subreddit.name,
  to: 'aeo-tracker',
  subject: `Alert - post removal by AEO`,
  text: pText,
})
    }
} catch(error){
console.error('Error getting mod logs:', error);
}
  }
}
);




export default Devvit;