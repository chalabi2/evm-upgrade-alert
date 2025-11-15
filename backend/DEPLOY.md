# Deployment Guide

## Quick Deploy (Local Testing)

```bash
# 1. Setup
bun install
cp .env.example .env
# Edit .env with your Discord webhook

# 2. Database
createdb evm_upgrades
psql evm_upgrades -f sql/schema.sql
bun run import-registry

# 3. Test
bun run monitor

# 4. Check Discord for Fusaka upgrade notification!
```

## Production Deploy with PM2

### Prerequisites

- Ubuntu/Debian VPS
- PostgreSQL 15+
- Bun runtime

### Steps

```bash
# 1. Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 2. Install PostgreSQL
sudo apt update
sudo apt install -y postgresql-15

# 3. Setup database
sudo -u postgres createdb evm_upgrades
sudo -u postgres psql evm_upgrades < sql/schema.sql

# 4. Clone and configure
git clone <your-repo> evm-upgrades
cd evm-upgrades
bun install
cp .env.example .env
nano .env  # Add your settings

# 5. Import chain registry
bun run import-registry

# 6. Install PM2
npm install -g pm2

# 7. Build and start services
bun run build

pm2 start bun --name evm-api -- start
pm2 start bun --name evm-scheduler -- run scheduler
pm2 start bun --name evm-indexer -- run start-indexer -- op-mainnet arbitrum-one base-mainnet

# 8. Setup auto-restart
pm2 startup
pm2 save

# 9. Check status
pm2 status
pm2 logs evm-scheduler --lines 50
```

### Monitoring

```bash
# View all logs
pm2 logs

# View specific service
pm2 logs evm-scheduler

# Real-time monitoring
pm2 monit

# Restart services
pm2 restart all

# Stop services
pm2 stop all
```

## Docker Deploy

### Prerequisites

- Docker & Docker Compose
- `.env` file configured

### Steps

```bash
# 1. Create .env
cp .env.example .env
# Edit with your settings

# 2. Update docker-compose.yml
# Change postgres password from "your_password_here"

# 3. Build and start
docker-compose up -d

# 4. Import registry (one-time)
docker-compose exec api bun run import-registry

# 5. Check logs
docker-compose logs -f scheduler

# 6. Check status
docker-compose ps
```

### Docker Commands

```bash
# View logs
docker-compose logs -f scheduler
docker-compose logs -f indexer

# Restart services
docker-compose restart

# Stop all
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

## Environment Variables

### Required

```bash
DATABASE_URL=postgresql://localhost:5432/evm_upgrades
```

### Recommended

```bash
# At least one notification channel
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# GitHub token for better rate limits
GITHUB_TOKEN=ghp_...

# Timezone for scheduler
TZ=America/Los_Angeles
SCRAPE_TIME=7
```

### Optional (RPC Overrides)

```bash
ETH_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
OP_MAINNET_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/...
ARBITRUM_ONE_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/...
BASE_MAINNET_RPC_URL=https://mainnet.base.org
```

## Verification

After deployment, verify everything works:

```bash
# 1. Check API
curl http://localhost:3000/v1/countdowns | jq .

# 2. Run monitor manually
bun run monitor
# or with Docker:
docker-compose exec scheduler bun run monitor

# 3. Check Discord/Telegram/Slack for notifications

# 4. View database
psql evm_upgrades -c "SELECT * FROM upgrade_plans;"
psql evm_upgrades -c "SELECT * FROM countdowns;"
```

## Troubleshooting

### Scheduler not running

```bash
# Check logs
pm2 logs evm-scheduler
# or
docker-compose logs scheduler

# Run manually
bun run monitor
```

### No notifications

```bash
# Test notifications
bun run test-notifications -- discord

# Verify webhook URL
echo $DISCORD_WEBHOOK_URL
```

### Database connection errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql evm_upgrades -c "SELECT 1;"

# Check DATABASE_URL in .env
```

### GitHub rate limiting

```bash
# Add GITHUB_TOKEN to .env
# Without token: 60 requests/hour
# With token: 5000 requests/hour
```

## Maintenance

### Update code

```bash
git pull
bun install
pm2 restart all
# or
docker-compose up -d --build
```

### Clear and re-scrape

```bash
bun run clear-data
bun run monitor
```

### Database backup

```bash
pg_dump evm_upgrades > backup_$(date +%Y%m%d).sql
```

### View metrics

```bash
# Upgrade count
psql evm_upgrades -c "SELECT COUNT(*) FROM upgrade_plans;"

# Recent releases
psql evm_upgrades -c "SELECT repo, tag, published_at FROM releases ORDER BY published_at DESC LIMIT 10;"

# On-chain events
psql evm_upgrades -c "SELECT chain_id, event_name, COUNT(*) FROM onchain_events GROUP BY chain_id, event_name;"
```
