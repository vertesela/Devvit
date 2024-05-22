import {
  Data,
  Devvit,
  FormFunction,
  FormOnSubmitEventHandler,
} from '@devvit/public-api';

const form: FormFunction = (data: Data) => {
  return {
    title: 'Dispense tokens',
    description:
      'The dispenses a given token amount to all players in the tournament. The starting balance of the tournament will also be updated so new players get the same amount.',
    fields: [
      {
        type: 'select',
        name: 'id',
        label: 'Tournament',
        required: true,
        options: data.tournaments,
        defaultValue: [data.tournaments[0].value],
      },
      {
        name: 'tokens',
        label: 'Tokens',
        type: 'number',
        defaultValue: 500,
        required: true,
      },
      {
        name: 'message',
        label: 'Message to players (optional)',
        type: 'paragraph',
      },
    ],
    acceptLabel: 'Dispense',
    cancelLabel: 'Cancel',
  };
};

const formHandler: FormOnSubmitEventHandler = async (event, context) => {
  const { ui, userId, scheduler } = context;
  if (!userId) return;

  if (!event.values.id || !event.values.tokens) {
    ui.showToast({ text: 'Invalid input' });
    return;
  }

  await scheduler.runJob({
    name: 'DispenseTokensTask',
    data: {
      tournamentId: event.values.id,
      tokens: event.values.tokens,
      message: event.values.message,
    },
    runAt: new Date(),
  });

  ui.showToast({ text: 'Dispensing tokens' });
};

export const dispenseTokensForm = Devvit.createForm(form, formHandler);
