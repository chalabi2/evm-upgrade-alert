import axios from 'axios';
import type { NotificationAdapter, AlertPayload } from './types.js';

export class SlackAdapter implements NotificationAdapter {
  constructor(private webhookUrl: string) {}

  async send(alert: AlertPayload): Promise<void> {
    const blocks = this.buildBlocks(alert);
    
    await axios.post(this.webhookUrl, {
      blocks: blocks,
      username: 'EVM Upgrades Monitor',
      icon_emoji: ':chains:'
    });
  }

  private buildBlocks(alert: AlertPayload) {
    const emoji = this.getEmojiForStage(alert.stage);
    const stageName = this.getStageName(alert.stage);
    
    const blocks: any[] = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${stageName}`,
        emoji: true
      }
    });

    // Main info section
    const fields: any[] = [
      {
        type: 'mrkdwn',
        text: `*Chain:*\n${alert.chain_name || alert.chain_id}`
      },
      {
        type: 'mrkdwn',
        text: `*Upgrade:*\n${alert.fork_name}`
      },
      {
        type: 'mrkdwn',
        text: `*Confidence:*\n${(alert.confidence * 100).toFixed(0)}%`
      }
    ];

    if (alert.activation_epoch) {
      fields.push({
        type: 'mrkdwn',
        text: `*Activation Epoch:*\n${alert.activation_epoch}`
      });
    }

    blocks.push({
      type: 'section',
      fields: fields
    });

    // Target time section
    if (alert.target_ts) {
      const targetDate = new Date(alert.target_ts);
      const timestamp = Math.floor(targetDate.getTime() / 1000);
      
      let timeText = `*Target Time:*\n<!date^${timestamp}^{date_num} {time_secs}|${targetDate.toUTCString()}>`;
      
      // Add countdown
      const now = Date.now();
      const diff = targetDate.getTime() - now;
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
          timeText += `\n⏳ *${days}d ${hours}h ${minutes}m* remaining`;
        } else if (hours > 0) {
          timeText += `\n⏳ *${hours}h ${minutes}m* remaining`;
        } else {
          timeText += `\n⏳ *${minutes}m* remaining`;
        }
      }

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: timeText
        }
      });
    }

    // Description
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: this.getDescription(alert)
        }
      ]
    });

    // Links
    if (alert.links && alert.links.length > 0) {
      const linkElements = alert.links.map((link, idx) => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: `Source ${idx + 1}`,
          emoji: true
        },
        url: link
      }));

      blocks.push({
        type: 'actions',
        elements: linkElements.slice(0, 5) // Slack limits to 5 buttons
      });
    }

    // Divider
    blocks.push({
      type: 'divider'
    });

    return blocks;
  }

  private getEmojiForStage(stage: string): string {
    const emojis: Record<string, string> = {
      rumor: '👂',
      proposal: '📝',
      vote_open: '🗳️',
      vote_passed: '✅',
      release_posted: '📦',
      scheduled: '📅',
      queued: '⏱️',
      'T-24h': '⚠️',
      'T-1h': '🚨',
      executed: '✨',
      canceled: '❌'
    };
    return emojis[stage] || '📢';
  }

  private getStageName(stage: string): string {
    const names: Record<string, string> = {
      rumor: 'Rumor Detected',
      proposal: 'Proposal Created',
      vote_open: 'Vote Open',
      vote_passed: 'Vote Passed',
      release_posted: 'Release Posted',
      scheduled: 'Upgrade Scheduled',
      queued: 'Queued On-Chain',
      'T-24h': '24 Hours Until Upgrade',
      'T-1h': '1 Hour Until Upgrade',
      executed: 'Upgrade Executed',
      canceled: 'Upgrade Canceled'
    };
    return names[stage] || stage.toUpperCase();
  }

  private getDescription(alert: AlertPayload): string {
    const descriptions: Record<string, string> = {
      rumor: 'Early signals detected for a potential upgrade.',
      proposal: 'A new upgrade proposal has been created.',
      vote_open: 'Governance vote is now open.',
      vote_passed: 'Governance vote has passed!',
      release_posted: 'Client release has been published.',
      scheduled: 'Upgrade has been officially scheduled.',
      queued: 'Upgrade transaction queued in timelock.',
      'T-24h': 'Upgrade activation in approximately 24 hours.',
      'T-1h': 'Upgrade activation imminent!',
      executed: 'Upgrade has been successfully executed.',
      canceled: 'Upgrade has been canceled.'
    };
    return descriptions[alert.stage] || 'Upgrade status update.';
  }
}
