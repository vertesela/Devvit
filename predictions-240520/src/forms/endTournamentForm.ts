import {
  Data,
  Devvit,
  FormFunction,
  FormOnSubmitEventHandler,
} from '@devvit/public-api';
import { Service } from '../service/Service.js';

const form: FormFunction = (data: Data) => {
  return {
    fields: [
      {
        type: 'select',
        name: 'id',
        label: 'Select a tournament',
        required: true,
        options: data.tournaments,
      },
      {
        name: 'message',
        label: 'Note to community (optional)',
        type: 'paragraph',
      },
    ],
    title: 'End tournament?',
    description:
      'Would you like to end the predictions tournament? All questions must be ended and resolved. This cannot be undone. You can optionally add a note to the community for the resolution message.',
    acceptLabel: 'End tournament',
    cancelLabel: 'Cancel',
  };
};

const formHandler: FormOnSubmitEventHandler = async (event, context) => {
  const { ui } = context;
  const service = new Service(context);

  if (!event.values.id) {
    ui.showToast({ text: 'No tournament found' });
    return;
  }
  await service.tournament.end(event.values.id, event.values.message);
  ui.showToast({ text: 'Tournament ended!' });
};

export const endTournamentForm = Devvit.createForm(form, formHandler);
