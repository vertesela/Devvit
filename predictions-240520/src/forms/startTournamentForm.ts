import { Devvit, Form, FormOnSubmitEventHandler } from '@devvit/public-api';
import { Service } from '../service/Service.js';
import { Tournament } from '../types/Tournament.js';
import { validateTournamentName } from '../utils/validateTournamentName.js';

const form: Form = {
  title: 'Predictions tournament',
  description:
    'The name of the tournament is shown to your community. Questions in this tournament will be grouped together and share a scoreboard.',
  acceptLabel: 'Start',
  cancelLabel: 'Cancel',
  fields: [
    {
      name: 'name',
      label: 'Tournament name',
      type: 'string',
      required: true,
    },
    {
      name: 'tokens',
      label: 'Token starting balance',
      type: 'number',
      defaultValue: 1000,
      required: true,
    },
  ],
};

const formHandler: FormOnSubmitEventHandler = async (event, context) => {
  const { ui, userId } = context;
  if (!userId) return;

  const service = new Service(context);

  // Name validation
  const nameValidation = validateTournamentName(event.values.name);
  if (!nameValidation.isValid) {
    ui.showToast({ text: nameValidation.errorMessage! });
    return;
  }

  const tournament: Tournament = {
    id: Date.now().toString(),
    name: event.values.name,
    tokens: event.values.tokens,
    created: Date.now(),
    authorId: userId,
    ended: false,
    playerCount: 0,
  };

  service.tournament.start(tournament);
  ui.showToast({ text: 'Tournament started!' });
};

export const startTournamentForm = Devvit.createForm(form, formHandler);
