import { getPool } from './db.js';

export type Chain = {
  id: string;
  chain_id?: number | null;
  name: string;
  type: 'L1' | 'L2' | 'testnet';
  family: string;
  genesis_unix?: number | null;
  slot_seconds?: number | null;
  slots_per_epoch?: number | null;
};

export type Source = {
  id?: number;
  chain_id: string;
  kind: string;
  url: string;
  active: boolean;
};

export type WatchAddress = {
  id?: number;
  chain_id: string;
  label: string;
  address: string;
  abi_kind: 'safe' | 'timelock' | 'governor';
};

export async function upsertChain(chain: Chain): Promise<void> {
  const pool = getPool();
  const sql = `
    INSERT INTO chains (id, chain_id, name, type, family, genesis_unix, slot_seconds, slots_per_epoch)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      chain_id = EXCLUDED.chain_id,
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      family = EXCLUDED.family,
      genesis_unix = EXCLUDED.genesis_unix,
      slot_seconds = EXCLUDED.slot_seconds,
      slots_per_epoch = EXCLUDED.slots_per_epoch
  `;
  await pool.query(sql, [
    chain.id,
    chain.chain_id,
    chain.name,
    chain.type,
    chain.family,
    chain.genesis_unix,
    chain.slot_seconds,
    chain.slots_per_epoch
  ]);
}

export async function upsertSource(source: Source): Promise<void> {
  const pool = getPool();
  const sql = `
    INSERT INTO sources (chain_id, kind, url, active)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (chain_id, kind, url) DO UPDATE SET
      active = EXCLUDED.active
  `;
  await pool.query(sql, [source.chain_id, source.kind, source.url, source.active]);
}

export async function upsertWatchAddress(watch: WatchAddress): Promise<void> {
  const pool = getPool();
  const sql = `
    INSERT INTO watch_addresses (chain_id, label, address, abi_kind)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (chain_id, address) DO UPDATE SET
      label = EXCLUDED.label,
      abi_kind = EXCLUDED.abi_kind
  `;
  await pool.query(sql, [watch.chain_id, watch.label, watch.address, watch.abi_kind]);
}

export async function getChains(): Promise<Chain[]> {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM chains ORDER BY id');
  return res.rows;
}

export async function getSourcesByChain(chainId: string): Promise<Source[]> {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM sources WHERE chain_id = $1 AND active = TRUE', [chainId]);
  return res.rows;
}

export async function getWatchAddressesByChain(chainId: string): Promise<WatchAddress[]> {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM watch_addresses WHERE chain_id = $1', [chainId]);
  return res.rows;
}
