#!/usr/bin/env node
import dotenv from 'dotenv';
import cron from 'node-cron';
import { UpgradeMonitor } from '../services/upgradeMonitor.js';

dotenv.config();

// Get timezone from env or default to America/Los_Angeles (PST/PDT)
const TIMEZONE = process.env.TZ || 'America/Los_Angeles';
const SCRAPE_TIME = process.env.SCRAPE_TIME || '7'; // 7am by default

console.log(`EVM Upgrades Scheduler`);
console.log(`Timezone: ${TIMEZONE}`);
console.log(`Monitor time: ${SCRAPE_TIME}:00 daily\n`);

const monitor = new UpgradeMonitor();

// Schedule: Run at 7am every day in your timezone
const cronExpression = `0 ${SCRAPE_TIME} * * *`;

cron.schedule(cronExpression, async () => {
  const now = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
  console.log(`\n[${now}] Running scheduled monitoring...`);
  
  try {
    await monitor.monitorAll();
    console.log('Scheduled monitoring completed successfully');
  } catch (error) {
    console.error('Scheduled monitoring failed:', error);
  }
}, {
  timezone: TIMEZONE
});

// Run once on startup
console.log('Running initial monitoring...');
monitor.monitorAll()
  .then(() => {
    console.log('Initial monitoring completed');
    console.log(`\nScheduler running. Next run at ${SCRAPE_TIME}:00 ${TIMEZONE}`);
    console.log('Press Ctrl+C to stop\n');
  })
  .catch((error) => {
    console.error('Initial monitoring failed:', error);
  });

// Keep process alive
process.on('SIGINT', () => {
  console.log('\nScheduler stopped');
  process.exit(0);
});
