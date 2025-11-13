import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { ChainIndexer } from './chainIndexer.js';
import { getWatchAddressesByChain } from '../lib/dao.js';

type RegistryChain = {
  id: string;
  name: string;
  rpc_urls?: string[];
  onchain_watch?: {
    timelocks?: Array<{ name: string; address: string }>;
    safes?: Array<{ name: string; address: string }>;
  };
};

type Registry = {
  version: number;
  chains: RegistryChain[];
};

export class IndexerManager {
  private indexers: Map<string, ChainIndexer> = new Map();

  async startAll(chainIds?: string[]): Promise<void> {
    const registryPath = path.resolve(process.cwd(), 'registry', 'chains.yaml');
    const raw = fs.readFileSync(registryPath, 'utf8');
    const registry = YAML.parse(raw) as Registry;

    const chainsToIndex = chainIds
      ? registry.chains.filter(c => chainIds.includes(c.id))
      : registry.chains;

    for (const chain of chainsToIndex) {
      // Check for environment variable override first
      const rpcUrl = this.getRpcUrl(chain.id, chain.rpc_urls);
      
      if (!rpcUrl) {
        console.log(`⏭️  Skipping ${chain.id}: No RPC URLs configured`);
        continue;
      }

      const hasWatchAddresses = 
        (chain.onchain_watch?.timelocks?.length ?? 0) > 0 ||
        (chain.onchain_watch?.safes?.length ?? 0) > 0;

      if (!hasWatchAddresses) {
        console.log(`⏭️  Skipping ${chain.id}: No watch addresses configured`);
        continue;
      }

      await this.startIndexer(chain.id, rpcUrl);
    }
  }

  async startIndexer(chainId: string, rpcUrl: string): Promise<void> {
    if (this.indexers.has(chainId)) {
      console.log(`⚠️  Indexer for ${chainId} already running`);
      return;
    }

    // Load watch addresses from DB
    const watchAddresses = await getWatchAddressesByChain(chainId);
    
    if (watchAddresses.length === 0) {
      console.log(`⏭️  Skipping ${chainId}: No watch addresses in database`);
      return;
    }

    // Determine starting block (could be from DB checkpoint, for now use recent)
    const fromBlock = await this.getStartingBlock(chainId);

    const indexer = new ChainIndexer({
      chainId,
      rpcUrl,
      watchAddresses,
      fromBlock,
      pollIntervalMs: 12000 // 12 seconds
    });

    this.indexers.set(chainId, indexer);
    
    // Start in background
    indexer.start().catch(err => {
      console.error(`Indexer for ${chainId} crashed:`, err);
      this.indexers.delete(chainId);
    });
  }

  stopIndexer(chainId: string): void {
    const indexer = this.indexers.get(chainId);
    if (indexer) {
      indexer.stop();
      this.indexers.delete(chainId);
    }
  }

  stopAll(): void {
    for (const [chainId, indexer] of this.indexers) {
      console.log(`Stopping indexer for ${chainId}...`);
      indexer.stop();
    }
    this.indexers.clear();
  }

  private getRpcUrl(chainId: string, registryUrls?: string[]): string | null {
    // Convert chain ID to env var format: eth-mainnet -> ETH_MAINNET_RPC_URL
    const envVarName = `${chainId.toUpperCase().replace(/-/g, '_')}_RPC_URL`;
    const envUrl = process.env[envVarName];
    
    if (envUrl) {
      console.log(`   🔧 Using custom RPC from ${envVarName}`);
      return envUrl;
    }
    
    // Fall back to registry
    if (registryUrls && registryUrls.length > 0) {
      return registryUrls[0];
    }
    
    return null;
  }

  private async getStartingBlock(chainId: string): Promise<number> {
    // TODO: Load last processed block from DB
    // For now, start from recent blocks (last 1000 blocks)
    const recentBlockOffset = 1000;
    
    // Could query the RPC for current block and subtract
    // For simplicity, return a reasonable default
    return Math.max(0, Date.now() / 1000 - 86400) as number; // ~24h ago in block time
  }
}
