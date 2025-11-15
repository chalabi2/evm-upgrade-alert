export { DiscordAdapter } from './discord.js';
export { TelegramAdapter } from './telegram.js';
export { SlackAdapter } from './slack.js';
export { NotificationDispatcher, configFromSubscription } from './dispatcher.js';
export type {
  AlertPayload,
  AlertStage,
  NotificationChannel,
  NotificationConfig,
  NotificationAdapter,
  NotificationResult
} from './types.js';
