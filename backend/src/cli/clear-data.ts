#!/usr/bin/env node
import dotenv from 'dotenv';
import { getPool, closePool } from '../lib/db.js';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('Clear EVM Upgrades Data\n');
  console.log('This will delete:');
  console.log('  - All upgrade plans');
  console.log('  - All countdowns');
  console.log('  - All on-chain events');
  console.log('  - All governance events');
  console.log('  - All alert subscriptions\n');
  
  const answer = await question('Are you sure? (yes/no): ');
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('Cancelled');
    rl.close();
    await closePool();
    return;
  }
  
  const pool = getPool();
  
  console.log('\nClearing data...');
  
  await pool.query('DELETE FROM alert_subscriptions');
  console.log('  Cleared alert_subscriptions');
  
  await pool.query('DELETE FROM countdowns');
  console.log('  Cleared countdowns');
  
  await pool.query('DELETE FROM upgrade_plans');
  console.log('  Cleared upgrade_plans');
  
  await pool.query('DELETE FROM onchain_events');
  console.log('  Cleared onchain_events');
  
  await pool.query('DELETE FROM governance_events');
  console.log('  Cleared governance_events');
  
  await pool.query('DELETE FROM releases');
  console.log('  Cleared releases');
  
  console.log('\nData cleared successfully!');
  console.log('\nTo repopulate, run:');
  console.log('  npm run scrape-ethereum');
  
  rl.close();
  await closePool();
}

main().catch((err) => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
