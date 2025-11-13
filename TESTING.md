# Testing On-Chain Governance

This guide covers testing the on-chain indexer for Optimism, Arbitrum, and Base.

## Prerequisites

1. Database setup complete
2. Registry imported
3. RPC endpoints configured (or using defaults)

## Test Setup

### 1. Configure RPC Endpoints (Optional)

Add to `.env` for better reliability:

```bash
OP_MAINNET_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_ONE_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_MAINNET_RPC_URL=https://mainnet.base.org
```

### 2. Verify Watch Addresses

Check what contracts we're monitoring:

```bash
psql evm_upgrades -c "
SELECT c.name, wa.label, wa.address, wa.abi_kind
FROM watch_addresses wa
JOIN chains c ON c.id = wa.chain_id
ORDER BY c.name, wa.label;
"
```

Should show:

- **Optimism**: OP Timelock, Security Councils (3)
- **Arbitrum**: DAO Timelock, Security Council
- **Base**: Base Timelock

## Running Tests

### Test 1: Start Indexer (Single Chain)

Test Optimism only:

```bash
bun run start-indexer -- op-mainnet
```

Expected output:

```
Starting Chain Indexer Manager...
✓ Loaded 1 chain(s) from database

[op-mainnet] Starting indexer for Optimism Mainnet
[op-mainnet] RPC: https://mainnet.optimism.io
[op-mainnet] Watching 4 address(es):
  - OP Timelock (timelock): 0x272C...
  - OP Security Council (Agora) (safe): 0x652B...
  - OP Security Council (Uniswap) (safe): 0x9282...
  - OP Security Council (OP Labs) (safe): 0x7ed8...
[op-mainnet] Starting from block: XXXXX
[op-mainnet] Polling every 12 seconds...
```

### Test 2: Start All L2 Indexers

```bash
bun run start-indexer -- op-mainnet arbitrum-one base-mainnet
```

Should start 3 indexers simultaneously.

### Test 3: Check for Events

Let the indexer run for a few minutes, then check database:

```bash
# Check if any events were captured
psql evm_upgrades -c "
SELECT chain_id, address, event_name, block_number, occurred_at
FROM onchain_events
ORDER BY occurred_at DESC
LIMIT 10;
"
```

### Test 4: Verify Event Parsing

If events are found:

```bash
# Check event details
psql evm_upgrades -c "
SELECT chain_id, event_name, args, tx_hash
FROM onchain_events
WHERE event_name IN ('CallScheduled', 'CallExecuted', 'ExecutionSuccess')
LIMIT 5;
"
```

### Test 5: Full System Test

Run the complete monitoring system:

```bash
# Terminal 1: Indexer
bun run start-indexer -- op-mainnet arbitrum-one base-mainnet

# Terminal 2: Monitor (will check indexer events)
bun run monitor
```

The monitor will:

1. Scrape Ethereum blog
2. Check GitHub releases
3. **Process on-chain events from indexer**
4. Send notifications for any detected upgrades

## Expected Behavior

### Normal Operation

- Indexer polls every 12 seconds
- Logs show: `[chain] Checked blocks XXXXX-YYYYY (0 events)`
- No errors in logs

### When Event Detected

```
[op-mainnet] Checked blocks 12345-12350 (1 events)
[op-mainnet] ✓ CallScheduled at block 12347
```

Event saved to database and will be picked up by next monitor run.

### When Upgrade Detected

If monitor finds on-chain events indicating an upgrade:

```
[On-Chain] Processing events from indexer...
[On-Chain] ✓ Created upgrade plan from CallScheduled on Optimism Mainnet

[Alerts] → Optimism Mainnet - Protocol Upgrade (queued)
[Alerts]   Sending to: discord
[Alerts]   ✓ discord
```

## Troubleshooting

### No events found

This is normal! On-chain governance events are rare. To verify the indexer is working:

1. Check it's polling: Look for "Checked blocks" logs
2. Verify RPC connection: Should not see connection errors
3. Check block range: Make sure it's not stuck on old blocks

### RPC errors

```
Error: could not detect network
```

**Solution**: Add custom RPC URL to `.env`

### Rate limiting

```
Error: 429 Too Many Requests
```

**Solution**:

- Use commercial RPC provider (Alchemy, Infura)
- Reduce polling frequency (edit `chainIndexer.ts`)

### Events not creating upgrade plans

Check the monitor is processing them:

```bash
bun run monitor
```

Look for `[On-Chain] Processing events from indexer...`

## Manual Event Injection (For Testing)

To test the full pipeline without waiting for real events:

```sql
-- Insert a fake CallScheduled event
INSERT INTO onchain_events (
  chain_id, address, event_name, tx_hash, block_number,
  args, occurred_at
) VALUES (
  'op-mainnet',
  '0x272Cf01607783CC9DB7506244dc6ac2f113702FC',
  'CallScheduled',
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  123456789,
  '{"delay": 86400, "description": "Test upgrade"}',
  NOW()
);
```

Then run monitor:

```bash
bun run monitor
```

Should create upgrade plan and send notification.

## Monitoring in Production

### PM2 Setup

```bash
# Start indexer for all L2s
pm2 start bun --name evm-indexer -- run start-indexer -- op-mainnet arbitrum-one base-mainnet

# Check logs
pm2 logs evm-indexer

# Monitor status
pm2 monit
```

### Check Indexer Health

```bash
# Last 50 lines of logs
pm2 logs evm-indexer --lines 50

# Check if it's running
pm2 status

# Restart if needed
pm2 restart evm-indexer
```

### Database Monitoring

```bash
# Count events per chain
psql evm_upgrades -c "
SELECT chain_id, COUNT(*) as event_count, MAX(occurred_at) as last_event
FROM onchain_events
GROUP BY chain_id;
"

# Check upgrade plans from on-chain events
psql evm_upgrades -c "
SELECT chain_id, fork_name, status, source_summary
FROM upgrade_plans
WHERE source_summary LIKE '%CallScheduled%'
   OR source_summary LIKE '%ExecutionSuccess%';
"
```

## Success Criteria

✅ Indexer starts without errors  
✅ Polls regularly (every 12 seconds)  
✅ Connects to RPC successfully  
✅ Watches correct contract addresses  
✅ Parses events when found  
✅ Saves events to database  
✅ Monitor processes events  
✅ Creates upgrade plans from events  
✅ Sends notifications

## Next Steps

Once on-chain monitoring is verified:

1. Add more chains to `registry/chains.yaml`
2. Add more contract addresses to watch
3. Implement custom event parsers for specific contracts
4. Add L2-specific upgrade detection logic
