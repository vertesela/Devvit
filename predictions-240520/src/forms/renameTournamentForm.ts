import {
  Devvit,
  FormFunction,
  Data,
  FormOnSubmitEventHandler,
} from '@devvit/public-api';
import { Service } from '../service/Service.js';
import { validateTournamentName } from '../utils/validateTournamentName.js';

const form: FormFunction = (data: Data) => {
  return {
    title: 'Rename current tournament',
    description:
      'The name of the tournament is shown to your community. This action does not affect the questions, the scoreboard, or message the players.',
    fields: [
      {
        type: 'select',
        name: 'id',
        label: 'Select a tournament',
        required: true,
        options: data.tournaments,
      },
      {
        type: 'string',
        name: 'name',
        label: 'New name',
        required: true,
      },
    ],
    acceptLabel: 'Rename',
    cancelLabel: 'Cancel',
  };
};

const formHandler: FormOnSubmitEventHandler = async (event, context) => {
  const { ui } = context;
  const service = new Service(context);
  const tournamentId = event.values.id;
  const newName = event.values.name;

  if (!tournamentId || !newName) {
    ui.showToast({ text: 'Invalid input' });
    return;
  }

  // Name validation
  const nameValidation = validateTournamentName(event.values.name);
  if (!nameValidation.isValid) {
    ui.showToast({ text: nameValidation.errorMessage! });
    return;
  }

  await service.tournament.rename(tournamentId, newName);
  ui.showToast({ text: 'Tournament renamed!' });
};

export const renameTournamentForm = Devvit.createForm(form, formHandler);
