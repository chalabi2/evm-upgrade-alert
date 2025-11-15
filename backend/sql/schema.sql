-- chains & static registry
CREATE TABLE IF NOT EXISTS chains (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('L1','L2','testnet')),
  family          TEXT NOT NULL,
  genesis_unix    BIGINT,
  slot_seconds    INT,
  slots_per_epoch INT
);

CREATE TABLE IF NOT EXISTS sources (
  id              BIGSERIAL PRIMARY KEY,
  chain_id        TEXT REFERENCES chains(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  url             TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(chain_id, kind, url)
);

CREATE TABLE IF NOT EXISTS raw_feed_items (
  id              BIGSERIAL PRIMARY KEY,
  source_id       BIGINT REFERENCES sources(id) ON DELETE CASCADE,
  external_id     TEXT,
  title           TEXT,
  url             TEXT,
  published_at    TIMESTAMPTZ,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  body_markdown   TEXT,
  raw_json        JSONB,
  UNIQUE(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS governance_events (
  id              BIGSERIAL PRIMARY KEY,
  chain_id        TEXT REFERENCES chains(id) ON DELETE CASCADE,
  stage           TEXT NOT NULL,
  source_ref      TEXT,
  source_kind     TEXT NOT NULL,
  title           TEXT,
  details         JSONB,
  occurred_at     TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS releases (
  id              BIGSERIAL PRIMARY KEY,
  chain_id        TEXT REFERENCES chains(id) ON DELETE CASCADE,
  repo            TEXT,
  tag             TEXT,
  url             TEXT,
  fork_name       TEXT,
  activation_epoch BIGINT,
  activation_ts   TIMESTAMPTZ,
  raw_json        JSONB,
  published_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS upgrade_plans (
  id              BIGSERIAL PRIMARY KEY,
  chain_id        TEXT REFERENCES chains(id) ON DELETE CASCADE,
  fork_name       TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('proposed','approved','scheduled','queued','executed','canceled','release_posted','announced')),
  activation_epoch BIGINT,
  activation_ts   TIMESTAMPTZ,
  confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  source_summary  TEXT,
  details         JSONB,  -- Comprehensive LLM-extracted data: keyPoints, technicalDetails, timeline, links, stakeholders, risks, requirements
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain_id, fork_name)
);

CREATE TABLE IF NOT EXISTS watch_addresses (
  id              BIGSERIAL PRIMARY KEY,
  chain_id        TEXT REFERENCES chains(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  address         TEXT NOT NULL,
  abi_kind        TEXT NOT NULL CHECK (abi_kind IN ('safe','timelock','governor')),
  UNIQUE(chain_id, address)
);

CREATE TABLE IF NOT EXISTS onchain_events (
  id              BIGSERIAL PRIMARY KEY,
  chain_id        TEXT REFERENCES chains(id) ON DELETE CASCADE,
  address         TEXT NOT NULL,
  tx_hash         TEXT NOT NULL,
  block_number    BIGINT NOT NULL,
  event_name      TEXT NOT NULL,
  args            JSONB,
  occurred_at     TIMESTAMPTZ NOT NULL,
  UNIQUE(chain_id, tx_hash, event_name, address)
);

CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               TEXT NOT NULL,
  chain_id              TEXT REFERENCES chains(id) ON DELETE CASCADE,
  fork_filter           TEXT,
  stages                TEXT[] NOT NULL,
  channels              TEXT[] NOT NULL,
  webhook_url           TEXT,
  email                 TEXT,
  discord_webhook       TEXT,
  telegram_bot_token    TEXT,
  telegram_chat_id      TEXT,
  slack_webhook         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS countdowns (
  chain_id        TEXT PRIMARY KEY REFERENCES chains(id) ON DELETE CASCADE,
  fork_name       TEXT NOT NULL,
  target_ts       TIMESTAMPTZ NOT NULL,
  window_low_ts   TIMESTAMPTZ,
  window_high_ts  TIMESTAMPTZ,
  confidence      NUMERIC(3,2) NOT NULL
);
