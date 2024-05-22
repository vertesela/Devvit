import {
  Data,
  Devvit,
  FormFunction,
  FormOnSubmitEventHandler,
} from '@devvit/public-api';

const form: FormFunction = (data: Data) => {
  return {
    title: 'Remove post?',
    description:
      'Would you like to remove this post and refund all players? This action cannot be undone.',
    fields: [
      {
        type: 'string',
        name: 'postId',
        label: 'Post Id',
        required: true,
        defaultValue: data.postId,
        disabled: true,
      },
      {
        name: 'message',
        label: 'Note to players (optional)',
        type: 'paragraph',
      },
    ],
    acceptLabel: 'Remove and refund',
    cancelLabel: 'Cancel',
  };
};

const formHandler: FormOnSubmitEventHandler = async (event, context) => {
  const { ui, scheduler } = context;

  if (!event.values.postId) {
    ui.showToast({ text: 'No post id found' });
    return;
  }

  await scheduler.runJob({
    name: 'RemovePostTask',
    data: {
      postId: event.values.postId,
      message: event.values.message,
    },
    runAt: new Date(),
  });

  ui.showToast({ text: 'Post removed!' });
};

export const removePostForm = Devvit.createForm(form, formHandler);
