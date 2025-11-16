export type UpgradeStatus =
  | 'proposed'
  | 'approved'
  | 'scheduled'
  | 'queued'
  | 'executed'
  | 'canceled'
  | 'release_posted'
  | 'announced';

export type ChainType = 'L1' | 'L2' | 'testnet';

export type ChainFamily = 'ethereum' | 'op-stack' | 'arbitrum' | 'avalanche';

export interface Chain {
  id: string;
  name: string;
  type: ChainType;
  family: ChainFamily;
  genesis_unix: number | null;
  slot_seconds: number | null;
  slots_per_epoch: number | null;
}

export interface UpgradeDetails {
  unixTimestamp?: number;
  keyPoints?: string[];
  timeline?: {
    upgradeDate?: string;
    mainnetActivation?: string;
  };
  technicalDetails?: {
    eips?: string[];
    features?: string[];
    dependencies?: string[];
  };
  requirements?: string[];
  risks?: string[];
  stakeholders?: {
    proposer?: string;
    reviewers?: string[];
    impacted?: string[];
  };
  links?: {
    specifications?: string[];
    github?: string[];
  };
}

export interface Upgrade {
  id: number;
  chain_id: string;
  chain_name: string;
  fork_name: string;
  status: UpgradeStatus;
  activation_epoch: number | null;
  activation_ts: string | null;
  confidence: number;
  source_summary: string;
  details: UpgradeDetails;
  last_updated_at: string;
}

export interface Countdown {
  chain_id: string;
  fork_name: string;
  target_ts: string;
  window_low_ts: string;
  window_high_ts: string;
  confidence: number;
}

export interface OnChainEvent {
  id: number;
  chain_id: string;
  chain_name: string;
  address: string;
  tx_hash: string;
  block_number: number;
  event_name: string;
  args: Record<string, unknown>;
  occurred_at: string;
}

export interface Release {
  id: number;
  chain_id: string;
  chain_name: string;
  repo: string;
  tag: string;
  url: string;
  fork_name: string | null;
  activation_epoch: number | null;
  activation_ts: string | null;
  raw_json: Record<string, unknown>;
  published_at: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

