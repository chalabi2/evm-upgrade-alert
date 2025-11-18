# EVM Upgrades Monitor - API Documentation

Base URL: `http://localhost:3000` (configurable via `PORT` env var)

All endpoints return JSON responses.

## Table of Contents

- [Health Check](#health-check)
- [Chains](#chains)
- [Upgrades](#upgrades)
- [Countdowns](#countdowns)
- [On-Chain Events](#on-chain-events)
- [Releases](#releases)
- [Alerts](#alerts)

---

## Health Check

### GET /health

Check if the API is running.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-11-13T19:00:00.000Z"
}
```

---

## Chains

### GET /v1/chains

Get all monitored chains.

**Response:**

```json
[
  {
    "id": "eth-mainnet",
    "name": "Ethereum Mainnet",
    "type": "L1",
    "family": "ethereum",
    "genesis_unix": 1606824023,
    "slot_seconds": 12,
    "slots_per_epoch": 32
  },
  {
    "id": "op-mainnet",
    "name": "Optimism Mainnet",
    "type": "L2",
    "family": "op-stack",
    "genesis_unix": null,
    "slot_seconds": null,
    "slots_per_epoch": null
  }
]
```

### GET /v1/chains/:chainId

Get details for a specific chain.

**Parameters:**

- `chainId` (path): Chain identifier (e.g., `eth-mainnet`, `op-mainnet`, `base-mainnet`)

**Example:**

```bash
GET /v1/chains/eth-mainnet
```

**Response:**

```json
{
  "id": "eth-mainnet",
  "name": "Ethereum Mainnet",
  "type": "L1",
  "family": "ethereum",
  "genesis_unix": 1606824023,
  "slot_seconds": 12,
  "slots_per_epoch": 32
}
```

---

## Upgrades

### GET /v1/upgrades

Get all upgrades with optional filtering.

**Query Parameters:**

- `status` (optional): Filter by status (`proposed`, `approved`, `scheduled`, `queued`, `executed`, `canceled`, `release_posted`, `announced`)
- `chain` (optional): Filter by chain ID

**Examples:**

```bash
# Get all upgrades
GET /v1/upgrades

# Get only scheduled upgrades
GET /v1/upgrades?status=scheduled

# Get upgrades for Optimism
GET /v1/upgrades?chain=op-mainnet

# Get scheduled upgrades for Ethereum
GET /v1/upgrades?status=scheduled&chain=eth-mainnet
```

**Response:**

```json
[
  {
    "id": 1,
    "chain_id": "op-mainnet",
    "chain_name": "Optimism Mainnet",
    "fork_name": "Jovian",
    "status": "scheduled",
    "activation_epoch": null,
    "activation_ts": "2025-12-03T21:49:11.000Z",
    "confidence": 0.5,
    "source_summary": "This upgrade updates the OP Stack to support Go 1.24...",
    "details": {
      "unixTimestamp": 1764798551,
      "keyPoints": [
        "Upgrades Cannon to Go 1.24...",
        "Introduces Minimum Base Fee..."
      ],
      "timeline": {
        "upgradeDate": "2025-11-26",
        "mainnetActivation": "2025-12-03T21:49:11Z"
      },
      "technicalDetails": {
        "eips": ["EIP-7594", "EIP-7892"],
        "features": ["Minimum Base Fee", "DA Footprint Block Limit"],
        "dependencies": ["Go 1.24 runtime"]
      },
      "requirements": ["Update node software to latest op-geth/op-reth..."],
      "risks": ["Potential L1 RPC breaking changes..."],
      "stakeholders": {
        "proposer": "George (OP Labs Protocol Engineer)",
        "reviewers": ["Paul Dowman", "Matt Solomon"],
        "impacted": ["Node operators", "Users, developers"]
      },
      "links": {
        "specifications": ["https://github.com/..."],
        "github": ["https://github.com/..."]
      }
    },
    "last_updated_at": "2025-11-13T19:00:00.000Z"
  }
]
```

### GET /v1/upgrades/:chainId

Get all upgrades for a specific chain.

**Parameters:**

- `chainId` (path): Chain identifier

**Example:**

```bash
GET /v1/upgrades/eth-mainnet
```

**Response:** Same format as `/v1/upgrades` but filtered to the specified chain.

---

## Countdowns

### GET /v1/countdowns

Get all calculated countdowns for upcoming upgrades.

**Response:**

```json
[
  {
    "chain_id": "eth-mainnet",
    "fork_name": "Fusaka",
    "target_ts": "2025-12-03T21:49:11.000Z",
    "window_low_ts": "2025-12-03T21:42:35.000Z",
    "window_high_ts": "2025-12-03T21:55:47.000Z",
    "confidence": 0.95
  }
]
```

### GET /v1/countdowns/:chainId

Get countdown for a specific chain.

**Parameters:**

- `chainId` (path): Chain identifier

**Example:**

```bash
GET /v1/countdowns/eth-mainnet
```

**Response:**

```json
{
  "chain_id": "eth-mainnet",
  "fork_name": "Fusaka",
  "target_ts": "2025-12-03T21:49:11.000Z",
  "window_low_ts": "2025-12-03T21:42:35.000Z",
  "window_high_ts": "2025-12-03T21:55:47.000Z",
  "confidence": 0.95
}
```

---

## On-Chain Events

### GET /v1/events

Get recent on-chain governance events.

**Query Parameters:**

- `chain` (optional): Filter by chain ID
- `limit` (optional): Number of events to return (default: 50, max: 100)

**Examples:**

```bash
# Get last 50 events
GET /v1/events

# Get last 20 events for Arbitrum
GET /v1/events?chain=arbitrum-one&limit=20
```

**Response:**

```json
[
  {
    "id": 1,
    "chain_id": "arbitrum-one",
    "chain_name": "Arbitrum One",
    "address": "0xA3d1a8DEB97B111454B294E2324EfAD13a9d8396",
    "tx_hash": "0x1234...",
    "block_number": 12345678,
    "event_name": "CallScheduled",
    "args": {
      "id": "0xabcd...",
      "target": "0x5678...",
      "value": "0",
      "delay": 259200
    },
    "occurred_at": "2025-11-13T18:00:00.000Z"
  }
]
```

---

## Releases

### GET /v1/releases

Get recent client releases.

**Query Parameters:**

- `chain` (optional): Filter by chain ID
- `fork` (optional): Filter by fork name
- `limit` (optional): Number of releases to return (default: 20, max: 50)

**Examples:**

```bash
# Get last 20 releases
GET /v1/releases

# Get Fusaka-related releases
GET /v1/releases?fork=Fusaka

# Get last 10 Ethereum releases
GET /v1/releases?chain=eth-mainnet&limit=10
```

**Response:**

```json
[
  {
    "id": 1,
    "chain_id": "eth-mainnet",
    "chain_name": "Ethereum Mainnet",
    "repo": "paradigmxyz/reth",
    "tag": "v1.9.2",
    "url": "https://github.com/paradigmxyz/reth/releases/tag/v1.9.2",
    "fork_name": "Fusaka",
    "activation_epoch": null,
    "activation_ts": null,
    "raw_json": { ... },
    "published_at": "2025-11-10T12:00:00.000Z"
  }
]
```

---

## Alerts

### POST /v1/alerts/subscribe

Create or update an alert subscription. Webhooks, bot tokens, and chat IDs are
encrypted at rest using `ALERT_SECRET_KEY` and are only decrypted during alert
delivery.

**Request Body:**

```json
{
  "user_id": "runbook-team",
  "chain_ids": ["eth-mainnet", "op-mainnet"],
  "fork_filter": "deneb",
  "stages": ["scheduled", "executed"],
  "alert_types": ["upgrades", "chain_events"],
  "channels": ["discord", "telegram"],
  "discord_webhook": "https://discord.com/api/webhooks/...",
  "telegram_bot_token": "12345:ABCDEF",
  "telegram_chat_id": "-1001234567"
}
```

**Response:**

```json
{
  "status": "accepted",
  "subscription": {
    "id": 42,
    "user_id": "runbook-team",
    "chain_id": null,
    "chain_ids": ["eth-mainnet", "op-mainnet"],
    "fork_filter": "deneb",
    "stages": ["scheduled", "executed"],
    "alert_types": ["upgrades", "chain_events"],
    "channels": ["discord", "telegram"],
    "created_at": "2025-11-17T20:00:00.000Z"
  }
}
```

Supported channels: `discord`, `slack`, `telegram`. Supported `alert_types`:
`upgrades`, `chain_events`, `releases`.

`chain_id` is accepted for single-chain subscriptions. Provide `chain_ids`
with multiple chain identifiers to scope alerts to a custom list. Omitting both
fields subscribes the contact to alerts from every chain.

---

## Error Responses

All endpoints may return these error responses:

### 404 Not Found

```json
{
  "error": "Not Found"
}
```

### 400 Bad Request

```json
{
  "error": "Invalid JSON"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal Server Error"
}
```

---

## Data Types

### Upgrade Status Values

- `proposed` - Upgrade has been proposed
- `approved` - Upgrade has been approved by governance
- `scheduled` - Upgrade has a confirmed activation date
- `queued` - Upgrade is queued in a timelock contract
- `executed` - Upgrade has been executed
- `canceled` - Upgrade was canceled
- `release_posted` - Client release for the upgrade is available
- `announced` - Upgrade has been announced

### Chain Types

- `L1` - Layer 1 blockchain
- `L2` - Layer 2 blockchain
- `testnet` - Testnet

### Chain Families

- `ethereum` - Ethereum and testnets
- `op-stack` - Optimism Stack chains (Optimism, Base, etc.)
- `arbitrum` - Arbitrum chains
- `avalanche` - Avalanche C-Chain

---

## CORS

The API currently does not set CORS headers. For frontend development, you may need to:

1. Run a proxy (e.g., `nginx`, `caddy`)
2. Use a browser extension for development
3. Add CORS middleware to the server

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting for production use.

---

## WebSocket Support

WebSocket support for real-time updates is not currently implemented but planned for future releases.

---

## Examples

### Fetch all scheduled upgrades

```javascript
const response = await fetch(
  "http://localhost:3000/v1/upgrades?status=scheduled"
);
const upgrades = await response.json();

upgrades.forEach((upgrade) => {
  console.log(`${upgrade.chain_name} - ${upgrade.fork_name}`);
  console.log(`Activation: ${upgrade.activation_ts}`);
  console.log(`Key Points:`, upgrade.details.keyPoints);
});
```

### Get countdown for Ethereum

```javascript
const response = await fetch("http://localhost:3000/v1/countdowns/eth-mainnet");
const countdown = await response.json();

const targetDate = new Date(countdown.target_ts);
const now = new Date();
const daysRemaining = Math.floor((targetDate - now) / (1000 * 60 * 60 * 24));

console.log(`${daysRemaining} days until ${countdown.fork_name}`);
```

### Monitor recent on-chain events

```javascript
const response = await fetch("http://localhost:3000/v1/events?limit=10");
const events = await response.json();

events.forEach((event) => {
  console.log(
    `${event.chain_name}: ${event.event_name} at block ${event.block_number}`
  );
});
```

---

## Frontend Integration Tips

1. **Polling**: Poll `/v1/upgrades?status=scheduled` every 30-60 seconds for updates
2. **Caching**: Cache chain list (`/v1/chains`) as it rarely changes
3. **Countdown Display**: Use `activation_ts` or `details.unixTimestamp` for client-side countdown timers
4. **Rich Details**: Display `details.keyPoints`, `details.requirements`, and `details.risks` for comprehensive upgrade information
5. **Timeline Visualization**: Use `details.timeline` to show upgrade vs activation dates
6. **Filtering**: Allow users to filter by chain and status
7. **Notifications**: Use `details.stakeholders.impacted` to show who needs to take action

---

## Development

Start the API server:

```bash
bun run dev
```

The API will be available at `http://localhost:3000`.

For production deployment, see [DEPLOY.md](./DEPLOY.md).
