export type AlertStage = 
  | 'rumor'
  | 'proposal'
  | 'vote_open'
  | 'vote_passed'
  | 'release_posted'
  | 'scheduled'
  | 'queued'
  | 'T-24h'
  | 'T-1h'
  | 'executed'
  | 'canceled';

export type AlertPayload = {
  chain_id: string;
  chain_name?: string;
  fork_name: string;
  stage: AlertStage;
  ts: string;
  activation_epoch?: number | null;
  activation_ts?: string | null;
  target_ts?: string | null;
  window_low_ts?: string | null;
  window_high_ts?: string | null;
  confidence: number;
  links?: string[];
  details?: Record<string, unknown>;
};

export type NotificationChannel = 'discord' | 'telegram' | 'slack' | 'webhook' | 'email';

export type NotificationConfig = {
  discord?: {
    webhook_url: string;
  };
  telegram?: {
    bot_token: string;
    chat_id: string;
  };
  slack?: {
    webhook_url: string;
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
};

export interface NotificationAdapter {
  send(alert: AlertPayload): Promise<void>;
}

export type NotificationResult = {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
};
