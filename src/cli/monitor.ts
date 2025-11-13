#!/usr/bin/env node
import dotenv from 'dotenv';
import { UpgradeMonitor } from '../services/upgradeMonitor.js';
import { closePool } from '../lib/db.js';

dotenv.config();

async function main() {
  console.log('EVM Upgrades - Unified Monitor\n');
  
  const monitor = new UpgradeMonitor();
  
  try {
    await monitor.monitorAll();
    console.log('✓ Monitoring complete\n');
  } catch (error) {
    console.error('✗ Monitoring failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
