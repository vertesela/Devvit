import {
  Devvit,
  Context,
  FormFunction,
  FormOnSubmitEvent,
  Data,
} from '@devvit/public-api';
import timezones from '../data/timezones.json';
import { Service } from '../service/Service.js';
import { createPostOptionsForm } from './createPostOptionsForm.js';
import { validatePostTitleInput } from '../utils/validatePostTitleInput.js';
import { validateDateInput } from '../utils/validateDateInput.js';
import { validateTimeInput } from '../utils/validateTimeInput.js';

const form: FormFunction = (data: Data) => {
  return {
    title: 'Create a prediction',
    description:
      'Once expired, users can no longer make predictions. You can also set the number of options for the prediction. You can add options in the next step.',
    acceptLabel: 'Continue',
    cancelLabel: 'Cancel',
    fields: [
      {
        name: 'tournamentId',
        label: 'Tournament',
        type: 'select',
        required: true,
        options: data.tournaments,
        defaultValue: [data.tournaments[0].value],
      },
      {
        name: 'question',
        label: 'Question',
        type: 'string',
        required: true,
      },
      {
        name: 'expiryDate',
        label: 'Expiry date (YYYY-MM-DD)',
        type: 'string',
        placeholder: 'YYYY-MM-DD',
        required: true,
      },
      {
        name: 'expiryTime',
        label: 'Expiry time (HH:MM) (military time)',
        type: 'string',
        placeholder: 'HH:MM',
        required: true,
      },
      {
        name: 'timezone',
        label: 'Timezone',
        type: 'select',
        required: true,
        defaultValue: ['America/Los_Angeles'],
        options: timezones.map((timezone: string) => ({
          label: timezone,
          value: timezone,
        })),
      },
      {
        name: 'optionCount',
        label: 'Option count',
        type: 'select',
        required: true,
        defaultValue: ['8'],
        options: [
          // We can fit 8 options per page.
          { label: '8 or less', value: '8' }, // 1 page
          { label: '16 or less', value: '16' }, // 2 pages
          { label: '32 or less', value: '32' }, // 4 pages
          { label: '64 or less', value: '64' }, // 8 pages
          { label: '128 or less', value: '128' }, // 16 pages
          { label: '256 or less', value: '256' }, // 32 pages
        ],
      },
    ],
  };
};

const formHandler = async (event: FormOnSubmitEvent, context: Context) => {
  const { ui, userId } = context;

  if (!userId) {
    ui.showToast({ text: 'You must be logged in to create a post.' });
    return;
  }

  // Post title validation
  const titleValidation = validatePostTitleInput(event.values.question);
  if (!titleValidation.isValid) {
    ui.showToast({ text: titleValidation.errorMessage! });
    return;
  }

  // Date validation
  const dateValidation = validateDateInput(event.values.expiryDate);
  if (!dateValidation.isValid) {
    ui.showToast({ text: dateValidation.errorMessage! });
    return;
  }

  // Time validation
  const timeValidation = validateTimeInput(event.values.expiryTime);
  if (!timeValidation.isValid) {
    ui.showToast({ text: timeValidation.errorMessage! });
    return;
  }

  const service = new Service(context);
  const result = await service.draft.save({
    tournamentId: event.values.tournamentId[0],
    question: event.values.question,
    expiryDate: event.values.expiryDate,
    expiryTime: event.values.expiryTime,
    timezone: event.values.timezone[0],
    optionCount: event.values.optionCount,
    userId,
  });

  const optionCount = parseInt(event.values.optionCount);

  ui.showForm(createPostOptionsForm, {
    optionCount,
    question: event.values.question,
  });
};

export const createPostForm = Devvit.createForm(form, formHandler);
