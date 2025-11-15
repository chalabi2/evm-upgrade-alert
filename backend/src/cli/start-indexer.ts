#!/usr/bin/env node
import dotenv from 'dotenv';
import { IndexerManager } from '../indexer/indexerManager.js';
import { closePool } from '../lib/db.js';

dotenv.config();

async function main() {
  const chainIds = process.argv.slice(2);
  
  console.log('🔍 EVM Upgrades Chain Indexer\n');
  
  if (chainIds.length > 0) {
    console.log(`Starting indexers for: ${chainIds.join(', ')}\n`);
  } else {
    console.log('Starting indexers for all configured chains\n');
  }

  const manager = new IndexerManager();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n⏹️  Shutting down indexers...');
    manager.stopAll();
    await closePool();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n⏹️  Shutting down indexers...');
    manager.stopAll();
    await closePool();
    process.exit(0);
  });

  try {
    await manager.startAll(chainIds.length > 0 ? chainIds : undefined);
    console.log('\n✅ All indexers started. Press Ctrl+C to stop.\n');
  } catch (error) {
    console.error('❌ Failed to start indexers:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
