import { SettingName } from './types.js';

const settings = [
  {
    name: SettingName.TrustedUsers,
    type: "string",
    label: "List of trusted users who can use the app",
  },
  {
    name: "OPoption",
    type: "boolean",
    label: "Allow OP to pin the comment?",
    defaultValue: false,
  },
  {
    name: "autoLock",
    type: "boolean",
    label: "Auto-lock app comments",
    defaultValue: true,
  },
  {
    type: "boolean",
    name: "sendModmail",
    label: "Send to Modmail?",
    helpText: "Receive notifications for mod pinnings.",
    defaultValue: false,
  },
  {
    type: "group",
    label: "Discord",
    helpText: "Notify moderators on Discord.",
    fields: [
      { name: "sendDiscord", type: "boolean", label: "Send to Discord?" },
      { name: "webhook", type: "string", label: "Webhook URL" },
      { name: "discordRole", type: "string", label: "Role ID to ping" },
    ],
  },
  {
    type: "group",
    label: "Notification",
    helpText: "Notify user about pinning the comment.",
    fields: [
      {
        name: "alertUser",
        type: "boolean",
        label: "Send notification to user?",
        defaultValue: false,
      },
      {
        name: "autoArchive",
        type: "boolean",
        label: "Auto-archive app messages?",
        defaultValue: true,
      },
    ],
  },
  {
    type: "group",
    label: "Pinned Post Flair",
    helpText: "Automatically update flair when a comment is spotlighted.",
    fields: [
      { name: "setFlair", type: "boolean", label: "Enable auto-flair?" },
      { name: "spotlightPostFlairText", type: "string", label: "Flair text" },
    ],
  },
];

export default settings;
