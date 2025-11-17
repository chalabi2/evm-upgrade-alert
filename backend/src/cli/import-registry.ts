#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { upsertChain, upsertSource, upsertWatchAddress } from '../lib/dao.js';
import { closePool } from '../lib/db.js';

type RegistryChain = {
  id: string;
  chain_id?: number;
  name: string;
  type: 'L1' | 'L2' | 'testnet';
  family: string;
  genesis_unix?: number;
  slot_seconds?: number;
  slots_per_epoch?: number;
  rpc_urls?: string[];
  offchain_sources?: Record<string, string | string[]>;
  onchain_watch?: {
    timelocks?: Array<{ name: string; address: string }>;
    safes?: Array<{ name: string; address: string }>;
  };
};

type Registry = {
  version: number;
  chains: RegistryChain[];
};

async function main() {
  const registryPath = path.resolve(process.cwd(), 'registry', 'chains.yaml');
  const raw = fs.readFileSync(registryPath, 'utf8');
  const registry = YAML.parse(raw) as Registry;

  console.log(`Importing ${registry.chains.length} chains...`);

  for (const chain of registry.chains) {
    await upsertChain({
      id: chain.id,
      chain_id: chain.chain_id,
      name: chain.name,
      type: chain.type,
      family: chain.family,
      genesis_unix: chain.genesis_unix,
      slot_seconds: chain.slot_seconds,
      slots_per_epoch: chain.slots_per_epoch
    });
    console.log(`  ✓ Chain: ${chain.id} (chain_id: ${chain.chain_id || 'none'})`);

    if (chain.offchain_sources) {
      for (const [kind, urlOrUrls] of Object.entries(chain.offchain_sources)) {
        const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
        for (const url of urls) {
          await upsertSource({ chain_id: chain.id, kind, url, active: true });
        }
      }
      console.log(`    ✓ Sources: ${Object.keys(chain.offchain_sources).length} kinds`);
    }

    if (chain.onchain_watch) {
      const { timelocks = [], safes = [] } = chain.onchain_watch;
      for (const tl of timelocks) {
        await upsertWatchAddress({
          chain_id: chain.id,
          label: tl.name,
          address: tl.address,
          abi_kind: 'timelock'
        });
      }
      for (const safe of safes) {
        await upsertWatchAddress({
          chain_id: chain.id,
          label: safe.name,
          address: safe.address,
          abi_kind: 'safe'
        });
      }
      console.log(`    ✓ Watch addresses: ${timelocks.length + safes.length}`);
    }
  }

  console.log('Import complete.');
  await closePool();
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
