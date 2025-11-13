import { ethers } from 'ethers';
import { getPool } from '../lib/db.js';
import { TIMELOCK_ABI, SAFE_ABI, GOVERNOR_ABI } from './abis.js';
import type { WatchAddress } from '../lib/dao.js';

export type IndexerConfig = {
  chainId: string;
  rpcUrl: string;
  watchAddresses: WatchAddress[];
  fromBlock: number;
  pollIntervalMs?: number;
};

export class ChainIndexer {
  private provider: ethers.JsonRpcProvider;
  private config: IndexerConfig;
  private lastProcessedBlock: number;
  private isRunning: boolean = false;

  constructor(config: IndexerConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.lastProcessedBlock = config.fromBlock;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(`Indexer for ${this.config.chainId} already running`);
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting indexer for ${this.config.chainId} from block ${this.lastProcessedBlock}`);
    console.log(`   RPC: ${this.config.rpcUrl}`);
    console.log(`   Watching ${this.config.watchAddresses.length} addresses`);

    await this.indexLoop();
  }

  stop(): void {
    this.isRunning = false;
    console.log(`⏹️  Stopping indexer for ${this.config.chainId}`);
  }

  private async indexLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processNewBlocks();
        await this.sleep(this.config.pollIntervalMs || 12000); // Default 12s
      } catch (error) {
        console.error(`Error in indexer for ${this.config.chainId}:`, error);
        await this.sleep(30000); // Wait 30s on error
      }
    }
  }

  private async processNewBlocks(): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber();
    
    if (currentBlock <= this.lastProcessedBlock) {
      return; // No new blocks
    }

    const toBlock = Math.min(this.lastProcessedBlock + 1000, currentBlock); // Process max 1000 blocks at a time
    
    console.log(`📦 ${this.config.chainId}: Processing blocks ${this.lastProcessedBlock + 1} to ${toBlock}`);

    for (const watchAddress of this.config.watchAddresses) {
      await this.processAddress(watchAddress, this.lastProcessedBlock + 1, toBlock);
    }

    this.lastProcessedBlock = toBlock;
  }

  private async processAddress(watch: WatchAddress, fromBlock: number, toBlock: number): Promise<void> {
    const abi = this.getAbiForKind(watch.abi_kind);
    const contract = new ethers.Contract(watch.address, abi, this.provider);

    try {
      // Get all events for this contract in the block range
      const filter = {
        address: watch.address,
        fromBlock,
        toBlock
      };

      const logs = await this.provider.getLogs(filter);
      
      for (const log of logs) {
        try {
          const parsed = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });

          if (parsed) {
            await this.saveEvent(watch, log, parsed);
          }
        } catch (parseError) {
          // Event not in our ABI, skip
        }
      }

      if (logs.length > 0) {
        console.log(`   ✓ ${watch.label}: Found ${logs.length} events`);
      }
    } catch (error) {
      console.error(`   ✗ ${watch.label}: Error fetching logs:`, error);
    }
  }

  private async saveEvent(
    watch: WatchAddress,
    log: ethers.Log,
    parsed: ethers.LogDescription
  ): Promise<void> {
    const pool = getPool();
    
    // Get block to extract timestamp
    const block = await this.provider.getBlock(log.blockNumber);
    if (!block) return;

    const args: Record<string, unknown> = {};
    parsed.args.forEach((value, index) => {
      const key = parsed.fragment.inputs[index]?.name || `arg${index}`;
      args[key] = typeof value === 'bigint' ? value.toString() : value;
    });

    const sql = `
      INSERT INTO onchain_events (chain_id, address, tx_hash, block_number, event_name, args, occurred_at)
      VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))
      ON CONFLICT (chain_id, tx_hash, event_name, address) DO NOTHING
    `;

    await pool.query(sql, [
      this.config.chainId,
      watch.address,
      log.transactionHash,
      log.blockNumber,
      parsed.name,
      JSON.stringify(args),
      block.timestamp
    ]);

    console.log(`   📝 Saved event: ${parsed.name} (tx: ${log.transactionHash.slice(0, 10)}...)`);
  }

  private getAbiForKind(kind: string): string[] {
    switch (kind) {
      case 'timelock':
        return TIMELOCK_ABI;
      case 'safe':
        return SAFE_ABI;
      case 'governor':
        return GOVERNOR_ABI;
      default:
        return [];
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
