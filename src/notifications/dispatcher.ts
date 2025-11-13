import type { AlertPayload, NotificationChannel, NotificationConfig, NotificationResult } from './types.js';
import { DiscordAdapter } from './discord.js';
import { TelegramAdapter } from './telegram.js';
import { SlackAdapter } from './slack.js';
import axios from 'axios';

export class NotificationDispatcher {
  async dispatch(
    alert: AlertPayload,
    channels: NotificationChannel[],
    config: NotificationConfig
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      try {
        await this.sendToChannel(alert, channel, config);
        results.push({ channel, success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ channel, success: false, error: errorMsg });
        console.error(`Failed to send to ${channel}:`, errorMsg);
      }
    }

    return results;
  }

  private async sendToChannel(
    alert: AlertPayload,
    channel: NotificationChannel,
    config: NotificationConfig
  ): Promise<void> {
    switch (channel) {
      case 'discord':
        if (!config.discord?.webhook_url) {
          throw new Error('Discord webhook URL not configured');
        }
        const discord = new DiscordAdapter(config.discord.webhook_url);
        await discord.send(alert);
        break;

      case 'telegram':
        if (!config.telegram?.bot_token || !config.telegram?.chat_id) {
          throw new Error('Telegram bot token or chat ID not configured');
        }
        const telegram = new TelegramAdapter(config.telegram.bot_token, config.telegram.chat_id);
        await telegram.send(alert);
        break;

      case 'slack':
        if (!config.slack?.webhook_url) {
          throw new Error('Slack webhook URL not configured');
        }
        const slack = new SlackAdapter(config.slack.webhook_url);
        await slack.send(alert);
        break;

      case 'webhook':
        if (!config.webhook?.url) {
          throw new Error('Webhook URL not configured');
        }
        await axios.post(config.webhook.url, alert, {
          headers: config.webhook.headers || { 'Content-Type': 'application/json' }
        });
        break;

      case 'email':
        // Email implementation would go here
        throw new Error('Email notifications not yet implemented');

      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }
}

// Helper function to load config from subscription record
export function configFromSubscription(subscription: {
  channels: string[];
  discord_webhook?: string | null;
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  slack_webhook?: string | null;
  webhook_url?: string | null;
}): NotificationConfig {
  const config: NotificationConfig = {};

  if (subscription.discord_webhook) {
    config.discord = { webhook_url: subscription.discord_webhook };
  }

  if (subscription.telegram_bot_token && subscription.telegram_chat_id) {
    config.telegram = {
      bot_token: subscription.telegram_bot_token,
      chat_id: subscription.telegram_chat_id
    };
  }

  if (subscription.slack_webhook) {
    config.slack = { webhook_url: subscription.slack_webhook };
  }

  if (subscription.webhook_url) {
    config.webhook = { url: subscription.webhook_url };
  }

  return config;
}
