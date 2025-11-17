# EVM Upgrades Monitor

A system to monitor governance events and protocol upgrades for EVM L1/L2 networks with real-time alerting.

## Features

- On-chain event monitoring (timelocks, multisigs, governors)
- Off-chain data aggregation (releases, forums, blogs)
- Countdown calculations for scheduled upgrades
- Multi-channel notifications (Discord, Telegram, Slack)
- State machine-driven upgrade lifecycle tracking

## Supported Chains

- Ethereum Mainnet & Sepolia
- Optimism Mainnet
- Base
- Arbitrum One
- Avalanche C-Chain

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Required
DATABASE_URL=postgresql://localhost:5432/evm_upgrades

# Timezone for scheduler (default: America/Los_Angeles)
TZ=America/Los_Angeles

# Daily monitoring time (hour in 24h format, default: 7 for 7am)
SCRAPE_TIME=7

# Optional: Custom RPC nodes (overrides defaults)
ETH_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
OP_MAINNET_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ARBITRUM_ONE_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Optional: Notifications (at least one required for alerts)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_CHAT_ID=-1001234567890
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_SECRET_KEY=replace-this-with-a-32-byte-secret

# Optional: GitHub token for higher API rate limits (60 -> 5000 requests/hour)
# Create at: https://github.com/settings/tokens (needs public_repo scope)
GITHUB_TOKEN=ghp_your_token_here
```

### 3. Setup Database

```bash
createdb evm_upgrades
psql evm_upgrades -f sql/schema.sql
bun run import-registry
```

### 4. Test Notifications (Optional)

```bash
bun run test-notifications -- discord telegram slack
```

### 5. Run the System

#### Option A: Development (Multiple Terminals)

```bash
# Terminal 1: API Server (serves countdown data)
bun run dev

# Terminal 2: Scheduler (monitors all sources daily at 7am)
bun run scheduler

# Terminal 3: On-chain Indexer (monitors L2 contracts continuously)
bun run start-indexer -- op-mainnet arbitrum-one base-mainnet
```

#### Option B: Manual (Run Once)

```bash
# Run all monitoring once
bun run monitor

# Check API
curl http://localhost:3000/v1/countdowns | jq .
```

#### Option C: Production (PM2)

```bash
# Install PM2
npm install -g pm2

# Build first
bun run build

# Start all services
pm2 start bun --name evm-api -- start
pm2 start bun --name evm-scheduler -- run scheduler
pm2 start bun --name evm-indexer -- run start-indexer -- op-mainnet arbitrum-one base-mainnet

# Check status
pm2 status

# View logs
pm2 logs evm-scheduler

# Restart all
pm2 restart all

# Stop all
pm2 stop all

# Auto-start on system reboot
pm2 startup
pm2 save
```

## Architecture

### Chain Registry (`registry/chains.yaml`)

Single source of truth for:

- RPC endpoints
- Contract addresses to monitor
- Off-chain data sources

### Database Schema (`sql/schema.sql`)

Core tables:

- `chains` - Chain configurations
- `onchain_events` - Timelock/Safe/Governor events
- `governance_events` - Normalized upgrade signals
- `upgrade_plans` - Synthesized upgrade schedules
- `countdowns` - Calculated activation times
- `alert_subscriptions` - User notification preferences

### On-Chain Monitoring (`src/indexer/`)

Polls RPC endpoints every 12 seconds for events from:

- TimelockController contracts (Optimism, Arbitrum, Base)
- Gnosis Safe multisigs (Security Councils)
- Governor contracts (DAO proposals)

Monitored addresses:

- Optimism Timelock: `0x272Cf01607783CC9DB7506244dc6ac2f113702FC`
- Arbitrum DAO Timelock: `0xA3d1a8DEB97B111454B294E2324EfAD13a9d8396`
- Arbitrum Security Council: `0x423552c0F05baCCac5Bfa91C6dCF1dc53a0A1641`
- Base Timelock: `0x272Cf01607783CC9DB7506244dc6ac2f113702FC`

### Notifications (`src/notifications/`)

Adapters for Discord, Telegram, and Slack with rich formatting:

- Color-coded embeds/messages by upgrade stage
- Countdown timers
- Clickable source links
- Stage indicators (proposal, scheduled, queued, executed)

## API Endpoints

```
GET  /v1/countdowns              List all countdowns
GET  /v1/countdowns/{chain_id}   Get countdown for specific chain
GET  /v1/upgrades/{chain_id}     Get upgrade plans for chain
POST /v1/alerts/subscribe        Create alert subscription
```

### Example: Subscribe to Alerts

```bash
curl -X POST http://localhost:3000/v1/alerts/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user@example.com",
    "chain_id": "eth-mainnet",
    "stages": ["scheduled", "executed"],
    "alert_types": ["upgrades", "chain_events"],
    "channels": ["discord"],
    "discord_webhook": "https://discord.com/api/webhooks/..."
  }'
```

All webhook URLs, bot tokens, and chat IDs are encrypted with AES-256-GCM
using `ALERT_SECRET_KEY` before being stored and are only decrypted while
dispatching alerts.

## Testing Notifications

```bash
bun run test-notifications -- discord telegram slack
```

## State Machine

Upgrade lifecycle stages:

1. `rumor` - Early signals detected
2. `proposal` - Formal proposal created
3. `vote_open` - Governance vote in progress
4. `vote_passed` - Vote succeeded
5. `release_posted` - Client release published
6. `scheduled` - Activation epoch/timestamp set
7. `queued` - Queued in timelock (on-chain)
8. `executed` - Upgrade completed
9. `canceled` - Upgrade canceled

Transitions defined in `config/state_machine.json`.

## Countdown Calculation

### Ethereum (Epoch-based)

```typescript
import { epochCountdownWindow } from "./src/contracts/countdown.js";

const countdown = epochCountdownWindow({
  genesisUnix: 1606824023,
  slotSeconds: 12,
  slotsPerEpoch: 32,
  activationEpoch: 269568,
});
// Returns: { targetUnix, windowLowUnix, windowHighUnix, confidence }
```

### L2s (Timestamp-based)

```typescript
import { timestampCountdown } from "./src/contracts/countdown.js";

const countdown = timestampCountdown(targetUnix, jitterSeconds);
```

## LLM-Powered Content Extraction

The system uses a local LLM to **comprehensively extract ALL important data** from governance forum posts, not just descriptions.

### What Gets Extracted

The LLM extracts structured data including:

- **Basic Info**: Title, fork name, concise description, status
- **Timeline**: All dates (proposal, voting, testnet, mainnet activation)
- **Technical Details**:
  - Features being added
  - EIP numbers (e.g., EIP-7594, EIP-7892)
  - Breaking changes
  - Dependencies (software versions, other upgrades)
- **Stakeholders**:
  - Proposer
  - Reviewers/approvers
  - Impacted parties (node operators, users, developers)
- **Requirements**: Specific actions operators/users must take
- **Risks**: Security concerns or risks mentioned
- **Links**: Specifications, documentation, GitHub PRs, audit reports
- **Activation**: Unix timestamps for precise countdown timers

### Example Extracted Data

From Optimism's Jovian/Fusaka proposal, the LLM extracted:

- 5 key features
- 3 EIP numbers
- 4 technical dependencies
- Breaking changes details
- 5 reviewers
- 3 impacted stakeholder groups
- 3 specific requirements
- 2 identified risks
- 8 specification/documentation links

All this data is stored in the `details` JSONB column and used for rich notifications.

### Configuration

Configure your LLM endpoint in `.env`:

```bash
LLM_ENDPOINT=http://192.168.0.103:1234/v1/chat/completions
```

The LLM must support OpenAI-compatible chat completions API. Tested with:

- **LM Studio** (recommended)
- **Ollama** (with OpenAI compatibility)
- **LocalAI**

If the LLM is unavailable, the system automatically falls back to regex-based extraction.

## RPC Configuration

Default public RPCs are configured in `registry/chains.yaml`. Override with environment variables:

```bash
{CHAIN_ID}_RPC_URL
```

Examples:

- `ETH_MAINNET_RPC_URL`
- `ETH_SEPOLIA_RPC_URL`
- `BASE_MAINNET_RPC_URL`
- `OP_MAINNET_RPC_URL`
- `ARBITRUM_ONE_RPC_URL`
- `AVALANCHE_C_RPC_URL`

The indexer checks environment variables first, then falls back to registry defaults.

## What Gets Monitored

The system monitors multiple sources for upgrade information:

### Off-Chain Sources (via Scheduler)

- **Ethereum Blog** - RSS feed + full HTML parsing for mainnet upgrades
- **GitHub Releases** - 13 major clients monitored:
  - Execution: Geth, Reth, Nethermind, Besu, Erigon
  - Consensus: Prysm, Lighthouse, Teku, Nimbus, Lodestar
  - L2: OP-Geth, Optimism, Arbitrum Nitro, Base

### On-Chain Sources (via Indexer)

- **Timelocks** - CallScheduled, CallExecuted events
- **Gnosis Safes** - Security Council multisig transactions
- **Governors** - DAO proposal execution

### How It Works

1. **Scheduler** runs daily at 7am (configurable) and:

   - Scrapes Ethereum blog for upgrade announcements
   - Checks GitHub for new client releases
   - Processes on-chain events from indexer
   - Sends notifications for new/updated upgrades

2. **Indexer** runs continuously and:

   - Polls L2 chains every 12 seconds
   - Detects timelock and multisig events
   - Stores events in database for scheduler to process

3. **API** serves countdown data and upgrade plans

## CLI Commands

```bash
# Setup
bun run import-registry              # Load chain registry into database

# Monitoring
bun run monitor                      # Run all monitoring once (manual)
bun run scheduler                    # Run scheduler (monitors daily at 7am)
bun run start-indexer                # Monitor all chains (on-chain events)
bun run start-indexer -- CHAIN_ID    # Monitor specific chain(s)

# API
bun run dev                          # Start API server (development)
bun run build && bun start           # Build and start API (production)

# Testing & Maintenance
bun run test-notifications -- CHANNELS  # Test notification channels
bun run clear-data                   # Clear upgrade data from database
```

## Event Mapping

### Ethereum

- Monitor: Client releases, EF blog, ethereum.org roadmap
- Trigger: Activation epoch published in release notes
- Countdown: Epoch-to-Unix conversion

### OP Stack (Optimism, Base)

- Monitor: Timelock events, governance votes, upgrade notices
- Trigger: `CallScheduled` event or timestamp announcement
- Countdown: Timestamp-based

### Arbitrum

- Monitor: DAO timelock, Security Council Safe, Tally votes
- Trigger: `CallScheduled` or Safe execution
- Countdown: Timestamp-based

### Avalanche

- Monitor: AvalancheGo releases
- Trigger: Activation timestamp in release notes
- Countdown: Timestamp-based

## File Structure

```
evm-upgrades/
├── config/
│   ├── alert_policy.json       # Alert policy defaults
│   └── state_machine.json      # Upgrade state transitions
├── registry/
│   └── chains.yaml             # Chain configurations
├── schemas/                    # JSON schemas for validation
├── sql/
│   └── schema.sql              # Database schema
├── src/
│   ├── cli/                    # CLI tools
│   ├── contracts/              # Countdown calculations
│   ├── indexer/                # On-chain monitoring
│   ├── lib/                    # Database & utilities
│   ├── notifications/          # Discord/Telegram/Slack
│   ├── scrapers/               # Off-chain data scrapers
│   ├── services/               # Monitoring orchestration
│   └── server.ts               # HTTP API
├── DEPLOY.md                   # Deployment guide
├── TESTING.md                  # Testing guide
└── README.md
```

## Testing

See `TESTING.md` for detailed testing instructions for:

- On-chain indexer (Optimism, Arbitrum, Base)
- Off-chain scrapers (Ethereum blog, GitHub)
- Notification system
- Full integration testing

Quick test:

```bash
# Test everything once
bun run monitor

# Test on-chain indexer
bun run start-indexer -- op-mainnet

# Check results
psql evm_upgrades -c "SELECT * FROM onchain_events LIMIT 5;"
```

## Development

The system is designed to be extended:

1. Add new chains in `registry/chains.yaml`
2. Run `bun run import-registry` to load into database
3. Indexer automatically picks up new chains with watch addresses
4. Add off-chain scrapers in `src/scrapers/` for new data sources

## Deployment

### Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: evm_upgrades
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"

  api:
    build: .
    command: bun run dev
    environment:
      DATABASE_URL: postgresql://postgres:your_password@postgres:5432/evm_upgrades
      DISCORD_WEBHOOK_URL: ${DISCORD_WEBHOOK_URL}
    ports:
      - "3000:3000"
    depends_on:
      - postgres

  scheduler:
    build: .
    command: bun run scheduler
    environment:
      DATABASE_URL: postgresql://postgres:your_password@postgres:5432/evm_upgrades
      TZ: America/Los_Angeles
      SCRAPE_TIME: 7
      DISCORD_WEBHOOK_URL: ${DISCORD_WEBHOOK_URL}
      GITHUB_TOKEN: ${GITHUB_TOKEN}
    depends_on:
      - postgres

  indexer:
    build: .
    command: bun run start-indexer -- op-mainnet arbitrum-one base-mainnet
    environment:
      DATABASE_URL: postgresql://postgres:your_password@postgres:5432/evm_upgrades
      OP_MAINNET_RPC_URL: ${OP_MAINNET_RPC_URL}
      ARBITRUM_ONE_RPC_URL: ${ARBITRUM_ONE_RPC_URL}
      BASE_MAINNET_RPC_URL: ${BASE_MAINNET_RPC_URL}
    depends_on:
      - postgres

volumes:
  postgres_data:
```

Create `Dockerfile`:

```dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .

CMD ["bun", "run", "dev"]
```

Deploy:

```bash
docker-compose up -d
docker-compose logs -f scheduler
```

### VPS Deployment (Ubuntu/Debian)

```bash
# Install dependencies
curl -fsSL https://bun.sh/install | bash
sudo apt install postgresql-15

# Setup database
sudo -u postgres createdb evm_upgrades
sudo -u postgres psql evm_upgrades < sql/schema.sql

# Clone and setup
git clone <your-repo>
cd evm-upgrades
bun install
cp .env.example .env
# Edit .env with your settings

# Import registry
bun run import-registry

# Install PM2
npm install -g pm2

# Start services
pm2 start bun --name evm-api -- run dev
pm2 start bun --name evm-scheduler -- run scheduler
pm2 start bun --name evm-indexer -- run start-indexer -- op-mainnet arbitrum-one base-mainnet

# Setup auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

## Production Considerations

- **RPC Providers**: Use commercial providers (Alchemy, Infura, QuickNode) for reliability
- **Rate Limits**: Add `GITHUB_TOKEN` for 5000 req/hour (vs 60 without)
- **Monitoring**: Set up alerts for PM2 process failures
- **Logging**: Configure log rotation for PM2 (`pm2 install pm2-logrotate`)
- **Database**: Regular backups and connection pooling
- **Security**: Use secrets management for tokens/webhooks
- **Scaling**: Run indexer per chain for better isolation

## Troubleshooting

### No upgrades detected

```bash
# Check if scheduler ran
pm2 logs evm-scheduler

# Run manually to test
bun run monitor
```

### Notifications not working

```bash
# Test notifications
bun run test-notifications -- discord

# Check webhook URLs in .env
```

### Database errors

```bash
# Verify schema
psql evm_upgrades -c "\dt"

# Re-import registry
bun run import-registry
```

### Rate limiting (GitHub)

```bash
# Add GITHUB_TOKEN to .env
# Create at: https://github.com/settings/tokens
# Scope: public_repo (read-only)
```

## License

MIT

## API Documentation

Complete API documentation for building frontends is available in [API.md](./API.md).

The API provides endpoints for:
- Fetching all upgrades with filtering
- Getting countdowns for specific chains
- Monitoring on-chain events
- Tracking client releases
- Health checks

See [API.md](./API.md) for detailed endpoint documentation, request/response examples, and frontend integration tips.
