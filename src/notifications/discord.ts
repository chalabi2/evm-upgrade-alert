import axios from 'axios';
import type { NotificationAdapter, AlertPayload } from './types.js';

export class DiscordAdapter implements NotificationAdapter {
  constructor(private webhookUrl: string) {}

  async send(alert: AlertPayload): Promise<void> {
    const embed = this.buildEmbed(alert);
    
    await axios.post(this.webhookUrl, {
      embeds: [embed],
      username: 'EVM Upgrades Monitor',
      avatar_url: 'https://ethereum.org/static/eth-diamond-purple.png'
    });
  }

  private buildEmbed(alert: AlertPayload) {
    const color = this.getColorForStage(alert.stage);
    
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

    // Activation time (most important - show first)
    if (alert.target_ts) {
      const targetDate = new Date(alert.target_ts);
      const now = Date.now();
      const diff = targetDate.getTime() - now;
      
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        fields.push({
          name: 'Time Remaining',
          value: days > 0 ? `**${days} days, ${hours} hours**` : `**${hours} hours**`,
          inline: false
        });
      }
      
      fields.push({
        name: 'Activation Time',
        value: `<t:${Math.floor(targetDate.getTime() / 1000)}:F>`,
        inline: false
      });
    }

    // Epoch if available
    if (alert.activation_epoch) {
      fields.push({
        name: 'Epoch',
        value: alert.activation_epoch.toString(),
        inline: true
      });
    }

    // Confidence
    fields.push({
      name: 'Confidence',
      value: `${(alert.confidence * 100).toFixed(0)}%`,
      inline: true
    });

    // Links
    if (alert.links && alert.links.length > 0) {
      fields.push({
        name: 'More Info',
        value: alert.links.map((link, i) => `[Link ${i + 1}](${link})`).join(' • '),
        inline: false
      });
    }

    // Source details
    if (alert.details && typeof alert.details === 'object' && 'source' in alert.details) {
      const source = (alert.details as any).source;
      if (typeof source === 'string') {
        fields.push({
          name: 'Source',
          value: source.slice(0, 200),
          inline: false
        });
      }
    }

    return {
      title: `${alert.chain_name || alert.chain_id} - ${alert.fork_name}`,
      description: `**${this.getStageName(alert.stage)}**`,
      color: color,
      fields: fields,
      timestamp: alert.ts
    };
  }

  private getColorForStage(stage: string): number {
    const colors: Record<string, number> = {
      rumor: 0x95a5a6,        // Gray
      proposal: 0x3498db,     // Blue
      vote_open: 0x9b59b6,    // Purple
      vote_passed: 0x2ecc71,  // Green
      release_posted: 0x1abc9c, // Turquoise
      scheduled: 0xf39c12,    // Orange
      queued: 0xe67e22,       // Dark orange
      'T-24h': 0xe74c3c,      // Red
      'T-1h': 0xc0392b,       // Dark red
      executed: 0x27ae60,     // Dark green
      canceled: 0x7f8c8d      // Dark gray
    };
    return colors[stage] || 0x3498db;
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
      canceled: 'Canceled'
    };
    return names[stage] || stage.toUpperCase();
  }
}
