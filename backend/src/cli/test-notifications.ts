#!/usr/bin/env node
import dotenv from 'dotenv';
import { NotificationDispatcher, AlertPayload } from '../notifications/index.js';

dotenv.config();

async function main() {
  const channels = process.argv.slice(2);
  
  if (channels.length === 0) {
    console.log('Usage: npm run test-notifications -- <channel1> [channel2] ...');
    console.log('Available channels: discord, telegram, slack');
    console.log('\nExample: npm run test-notifications -- discord telegram');
    console.log('\nMake sure to set the following environment variables:');
    console.log('  DISCORD_WEBHOOK_URL');
    console.log('  TELEGRAM_BOT_TOKEN');
    console.log('  TELEGRAM_CHAT_ID');
    console.log('  SLACK_WEBHOOK_URL');
    process.exit(1);
  }

  const testAlert: AlertPayload = {
    chain_id: 'eth-mainnet',
    chain_name: 'Ethereum Mainnet',
    fork_name: 'Test Upgrade',
    stage: 'scheduled',
    ts: new Date().toISOString(),
    target_ts: new Date(Date.now() + 86400000).toISOString(), // 24h from now
    window_low_ts: new Date(Date.now() + 86400000 - 300000).toISOString(),
    window_high_ts: new Date(Date.now() + 86400000 + 300000).toISOString(),
    confidence: 1.0,
    links: ['https://ethereum.org/en/roadmap/'],
    details: {
      test: true,
      message: 'This is a test notification from EVM Upgrades Monitor'
    }
  };

  const config: any = {};

  if (channels.includes('discord')) {
    if (!process.env.DISCORD_WEBHOOK_URL) {
      console.error('❌ DISCORD_WEBHOOK_URL not set');
      process.exit(1);
    }
    config.discord = { webhook_url: process.env.DISCORD_WEBHOOK_URL };
  }

  if (channels.includes('telegram')) {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      console.error('❌ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
      process.exit(1);
    }
    config.telegram = {
      bot_token: process.env.TELEGRAM_BOT_TOKEN,
      chat_id: process.env.TELEGRAM_CHAT_ID
    };
  }

  if (channels.includes('slack')) {
    if (!process.env.SLACK_WEBHOOK_URL) {
      console.error('❌ SLACK_WEBHOOK_URL not set');
      process.exit(1);
    }
    config.slack = { webhook_url: process.env.SLACK_WEBHOOK_URL };
  }

  console.log(`📤 Sending test notification to: ${channels.join(', ')}`);
  
  const dispatcher = new NotificationDispatcher();
  const results = await dispatcher.dispatch(testAlert, channels as any, config);

  console.log('\n📊 Results:');
  for (const result of results) {
    if (result.success) {
      console.log(`  ✅ ${result.channel}: Success`);
    } else {
      console.log(`  ❌ ${result.channel}: Failed - ${result.error}`);
    }
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
