import axios from 'axios';
import type { NotificationAdapter, AlertPayload } from './types.js';

export class TelegramAdapter implements NotificationAdapter {
  private apiUrl: string;

  constructor(private botToken: string, private chatId: string) {
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async send(alert: AlertPayload): Promise<void> {
    const message = this.buildMessage(alert);
    
    await axios.post(`${this.apiUrl}/sendMessage`, {
      chat_id: this.chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
  }

  private buildMessage(alert: AlertPayload): string {
    const emoji = this.getEmojiForStage(alert.stage);
    const stageName = this.getStageName(alert.stage);
    
    let message = `${emoji} <b>${stageName}</b>\n\n`;
    
    // Chain and upgrade info
    message += `🔗 <b>Chain:</b> ${alert.chain_name || alert.chain_id}\n`;
    message += `🚀 <b>Upgrade:</b> ${alert.fork_name}\n`;
    message += `📊 <b>Confidence:</b> ${(alert.confidence * 100).toFixed(0)}%\n`;
    
    // Activation details
    if (alert.activation_epoch) {
      message += `📍 <b>Activation Epoch:</b> ${alert.activation_epoch}\n`;
    }
    
    if (alert.target_ts) {
      const targetDate = new Date(alert.target_ts);
      message += `⏰ <b>Target Time:</b> ${targetDate.toUTCString()}\n`;
      
      // Countdown
      const now = Date.now();
      const diff = targetDate.getTime() - now;
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
          message += `⏳ <b>Time Remaining:</b> ${days}d ${hours}h ${minutes}m\n`;
        } else if (hours > 0) {
          message += `⏳ <b>Time Remaining:</b> ${hours}h ${minutes}m\n`;
        } else {
          message += `⏳ <b>Time Remaining:</b> ${minutes}m\n`;
        }
      }
    }
    
    // Window info
    if (alert.window_low_ts && alert.window_high_ts) {
      const lowDate = new Date(alert.window_low_ts);
      const highDate = new Date(alert.window_high_ts);
      const windowMinutes = Math.floor((highDate.getTime() - lowDate.getTime()) / (1000 * 60));
      message += `📏 <b>Time Window:</b> ±${Math.floor(windowMinutes / 2)} minutes\n`;
    }
    
    message += `\n<i>${this.getDescription(alert)}</i>`;
    
    // Links
    if (alert.links && alert.links.length > 0) {
      message += '\n\n🔗 <b>Links:</b>\n';
      alert.links.forEach((link, idx) => {
        message += `  • <a href="${link}">Source ${idx + 1}</a>\n`;
      });
    }
    
    return message;
  }

  private getEmojiForStage(stage: string): string {
    const emojis: Record<string, string> = {
      rumor: '👂',
      proposal: '📝',
      vote_open: '🗳',
      vote_passed: '✅',
      release_posted: '📦',
      scheduled: '📅',
      queued: '⏱',
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
