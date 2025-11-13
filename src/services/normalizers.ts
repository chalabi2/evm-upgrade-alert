export type ReleaseInput = {
  chain_id: string;
  fork_name: string;
  repo?: string;
  tag?: string;
  url?: string;
  activation_epoch?: number | null;
  activation_ts?: string | null;
  published_at: string;
};

export type GovEventInput = {
  chain_id: string;
  stage: 'rumor'|'proposal'|'vote_open'|'vote_passed'|'release_posted'|'scheduled'|'queued'|'executed'|'canceled';
  source_kind: 'forum'|'release'|'roadmap'|'ef_blog'|'github'|'timelock'|'safe'|'governor';
  source_ref?: string;
  title?: string;
  details?: Record<string, unknown>;
  occurred_at: string;
};

export type OnchainEventInput = {
  chain_id: string;
  address: string;
  event_name: string;
  tx_hash: string;
  block_number: number;
  args?: Record<string, unknown>;
  occurred_at: string;
};

export interface UpgradeSynthesizer {
  upsertFromRelease(r: ReleaseInput): Promise<void>;
  upsertFromGovEvent(e: GovEventInput): Promise<void>;
  upsertFromOnchain(e: OnchainEventInput): Promise<void>;
}

export class NoopSynthesizer implements UpgradeSynthesizer {
  async upsertFromRelease(): Promise<void> { /* integrate DB later */ }
  async upsertFromGovEvent(): Promise<void> { /* integrate DB later */ }
  async upsertFromOnchain(): Promise<void> { /* integrate DB later */ }
}
