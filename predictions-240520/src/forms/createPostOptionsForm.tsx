import {
  Devvit,
  Data,
  FormField,
  FormFunction,
  Context,
  FormOnSubmitEvent,
} from '@devvit/public-api';
import { Preview } from '../components/Preview.js';
import { Service } from '../service/Service.js';
import { Option } from '../types/Option.js';
import { Post } from '../types/Post.js';
import { getUTCTimestamp } from '../utils/getUTCTimestamp.js';

const form: FormFunction = (data: Data) => {
  const fields = [];
  const { optionCount = 8 } = data;

  for (let i = 0; i < optionCount; i++) {
    const isRequired = i < 2;
    fields.push({
      name: `option:${i}`,
      label: `Option ${i + 1}${isRequired ? '' : ' (optional)'}`,
      type: 'string',
      required: isRequired,
    } as FormField);
  }

  return {
    fields,
    title: data.question || 'Create a prediction',
    description:
      'Please add option values. You do not need to use all fields. You probably want some form of "Other" or "None of the above" option.',
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  };
};

const formHandler = async (event: FormOnSubmitEvent, context: Context) => {
  const { reddit, ui, userId } = context;
  const service = new Service(context);

  if (!userId) {
    ui.showToast({ text: 'You must be logged in to create a post.' });
    return;
  }

  // TODO: Form validation

  const [draft, user, subreddit] = await Promise.all([
    await service.draft.get(userId),
    await reddit.getCurrentUser(),
    await reddit.getCurrentSubreddit(),
  ]);

  if (!draft) {
    ui.showToast({ text: 'No draft found' });
    return;
  }

  if (!draft.tournamentId) {
    ui.showToast({ text: 'No tournament found' });
    return;
  }

  const post = await reddit.submitPost({
    title: draft.question,
    subredditName: subreddit.name,
    preview: <Preview />,
  });

  // filter out any values from event.values that are undefined
  // this is necessary because d2x doesn't omit undefined values
  const filteredValues: Data = Object.keys(event.values).reduce(
    (acc: Data, key) => {
      if (event.values[key]) {
        acc[key] = event.values[key];
      }
      return acc;
    },
    {}
  );

  const options: Option[] = Object.keys(filteredValues).map((key, index) => {
    return {
      label: filteredValues[key],
      id: index.toString(),
      votes: 0,
    };
  });

  const createdTime = Date.now();
  const expiryTime = getUTCTimestamp(
    draft.expiryDate,
    draft.expiryTime,
    draft.timezone
  );

  const postData: Post = {
    postId: post.id,
    options,
    title: draft.question,
    authorId: userId,
    created: createdTime,
    ends: expiryTime,
    ended: createdTime > expiryTime,
    votes: 0,
    tokens: 0,
    tournamentId: draft.tournamentId,
  };

  await service.post.create(postData);

  // Schedule a reminder for the post creator when the post expires
  await context.scheduler.runJob({
    name: 'PostExpiryNotification',
    data: {
      username: user.username,
      postId: post.id,
      question: draft.question,
    },
    runAt: new Date(expiryTime),
  });

  ui.showToast({ text: 'Post created!' });
};

export const createPostOptionsForm = Devvit.createForm(form, formHandler);
