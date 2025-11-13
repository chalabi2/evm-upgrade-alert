#!/usr/bin/env node
import dotenv from 'dotenv';
import { ChainIndexer } from '../indexer/chainIndexer.js';
import { getPool, closePool } from '../lib/db.js';

dotenv.config();

async function main() {
  const chainId = process.argv[2];
  const blocksToScan = parseInt(process.argv[3] || '10000');
  
  if (!chainId) {
    console.error('Usage: bun run scan-historical -- <chain-id> [blocks-to-scan]');
    console.error('Example: bun run scan-historical -- op-mainnet 50000');
    process.exit(1);
  }

  console.log(`Historical Event Scanner`);
  console.log(`Chain: ${chainId}`);
  console.log(`Scanning last ${blocksToScan.toLocaleString()} blocks\n`);

  const pool = getPool();
  
  // Get chain info
  const chainResult = await pool.query(
    'SELECT id, name FROM chains WHERE id = $1',
    [chainId]
  );
  
  if (chainResult.rows.length === 0) {
    console.error(`Chain ${chainId} not found in database`);
    await closePool();
    process.exit(1);
  }

  const chain = chainResult.rows[0];
  
  // Get RPC URL (check env first)
  const envVarName = `${chainId.toUpperCase().replace(/-/g, '_')}_RPC_URL`;
  const rpcUrl = process.env[envVarName] || chain.rpc_urls[0];
  
  if (!rpcUrl) {
    console.error(`No RPC URL configured for ${chainId}`);
    await closePool();
    process.exit(1);
  }

  console.log(`Using RPC: ${rpcUrl}`);

  // Get watch addresses
  const watchResult = await pool.query(
    'SELECT label, address, abi_kind FROM watch_addresses WHERE chain_id = $1',
    [chainId]
  );

  if (watchResult.rows.length === 0) {
    console.error(`No watch addresses configured for ${chainId}`);
    await closePool();
    process.exit(1);
  }

  console.log(`Watching ${watchResult.rows.length} address(es):`);
  watchResult.rows.forEach(w => {
    console.log(`  - ${w.label} (${w.abi_kind}): ${w.address}`);
  });
  console.log('');

  // Get current block first
  const { ethers } = await import('ethers');
  const { TIMELOCK_ABI, SAFE_ABI, GOVERNOR_ABI } = await import('../indexer/abis.js');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - blocksToScan;
  
  console.log(`Current block: ${currentBlock.toLocaleString()}`);
  console.log(`Scanning from block: ${startBlock.toLocaleString()}`);
  console.log(`This may take a few minutes...\n`);

  const getAbi = (kind: string) => {
    switch (kind) {
      case 'timelock': return TIMELOCK_ABI;
      case 'safe': return SAFE_ABI;
      case 'governor': return GOVERNOR_ABI;
      default: return [];
    }
  };

  try {
    // Scan in chunks of 1000 blocks
    const chunkSize = 1000;
    let totalEvents = 0;
    
    for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += chunkSize) {
      const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
      
      process.stdout.write(`\rScanning blocks ${fromBlock.toLocaleString()} - ${toBlock.toLocaleString()}...`);
      
      // Scan each watch address
      for (const watch of watchResult.rows) {
        const abi = getAbi(watch.abi_kind);
        const contract = new ethers.Contract(watch.address, abi, provider);
        
        try {
          const logs = await provider.getLogs({
            address: watch.address,
            fromBlock,
            toBlock
          });
          
          for (const log of logs) {
            try {
              const parsed = contract.interface.parseLog({
                topics: log.topics as string[],
                data: log.data
              });
              
              if (parsed) {
                // Get block timestamp
                const block = await provider.getBlock(log.blockNumber);
                if (!block) continue;
                
                // Save to database
                const args: Record<string, unknown> = {};
                parsed.args.forEach((value: any, index: number) => {
                  const key = parsed.fragment.inputs[index]?.name || `arg${index}`;
                  args[key] = typeof value === 'bigint' ? value.toString() : value;
                });
                
                await pool.query(`
                  INSERT INTO onchain_events (chain_id, address, tx_hash, block_number, event_name, args, occurred_at)
                  VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))
                  ON CONFLICT (chain_id, tx_hash, event_name, address) DO NOTHING
                `, [
                  chainId,
                  watch.address,
                  log.transactionHash,
                  log.blockNumber,
                  parsed.name,
                  JSON.stringify(args),
                  block.timestamp
                ]);
                
                console.log(`\n  ✓ Found ${parsed.name} at block ${log.blockNumber} (tx: ${log.transactionHash.slice(0, 10)}...)`);
                totalEvents++;
              }
            } catch (parseError) {
              // Event not in our ABI, skip
            }
          }
        } catch (error) {
          // Continue on error
        }
      }
    }
    
    console.log(`\n\n✓ Scan complete!`);
    console.log(`Total events found: ${totalEvents}`);
    
    if (totalEvents > 0) {
      console.log(`\nEvents saved to database. View with:`);
      console.log(`psql evm_upgrades -c "SELECT chain_id, event_name, block_number, occurred_at FROM onchain_events ORDER BY occurred_at DESC LIMIT 10;"`);
    }
    
  } catch (error) {
    console.error('\n✗ Scan failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
