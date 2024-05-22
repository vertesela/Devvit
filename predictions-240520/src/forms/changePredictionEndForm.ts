import {
  Devvit,
  FormFunction,
  Data,
  FormOnSubmitEventHandler,
} from '@devvit/public-api';
import timezones from '../data/timezones.json';
import { Service } from '../service/Service.js';
import { validateTimeInput } from '../utils/validateTimeInput.js';
import { validateDateInput } from '../utils/validateDateInput.js';
import { getUTCTimestamp } from '../utils/getUTCTimestamp.js';

const form: FormFunction = (data: Data) => {
  return {
    title: 'Change end time',
    description:
      'Provide a new end time for this question. After this time, users will no longer be able to make predictions.',
    fields: [
      {
        type: 'string',
        name: 'postId',
        label: 'Post Id',
        required: true,
        disabled: true,
        defaultValue: data.postId,
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
    ],
    acceptLabel: 'Confirm',
    cancelLabel: 'Cancel',
  };
};

const formHandler: FormOnSubmitEventHandler = async (event, context) => {
  const { ui } = context;
  const service = new Service(context);
  const postId = event.values.postId;

  if (!postId) {
    ui.showToast({ text: 'Missing post id' });
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

  const expiryTime = getUTCTimestamp(
    event.values.expiryDate,
    event.values.expiryTime,
    event.values.timezone
  );

  await service.post.changeEndTime(postId, expiryTime);
  ui.showToast({ text: 'New end time set' });
};

export const changePredictionEndForm = Devvit.createForm(form, formHandler);
