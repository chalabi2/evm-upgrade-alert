import fs from 'node:fs';
import path from 'node:path';

export type UpgradeState = 'proposed' | 'approved' | 'scheduled' | 'queued' | 'executed' | 'canceled';
export type UpgradeInput =
  | 'forum_proposal'
  | 'vote_passed'
  | 'release_posted'
  | 'epoch_published'
  | 'timestamp_announced'
  | 'timelock_queued'
  | 'timelock_executed'
  | 'safe_exec'
  | 'cancellation';

export type StateMachineConfig = {
  states: UpgradeState[];
  inputs: UpgradeInput[];
  transitions: Record<UpgradeState, Partial<Record<UpgradeInput, UpgradeState>>>;
  countdown_update_triggers: UpgradeInput[];
  alert_default_milestones: string[];
};

let cachedConfig: StateMachineConfig | null = null;

export function loadStateMachineConfig(configPath?: string): StateMachineConfig {
  if (cachedConfig) return cachedConfig;
  const resolved = configPath || path.resolve(process.cwd(), 'config', 'state_machine.json');
  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw) as StateMachineConfig;
  cachedConfig = parsed;
  return parsed;
}

export function getNextState(current: UpgradeState, input: UpgradeInput, cfg?: StateMachineConfig): UpgradeState | null {
  const c = cfg || loadStateMachineConfig();
  const table = c.transitions[current] || {};
  return table[input] ?? null;
}

export function shouldUpdateCountdown(input: UpgradeInput, cfg?: StateMachineConfig): boolean {
  const c = cfg || loadStateMachineConfig();
  return c.countdown_update_triggers.includes(input);
}

export function getDefaultAlertMilestones(cfg?: StateMachineConfig): string[] {
  const c = cfg || loadStateMachineConfig();
  return [...c.alert_default_milestones];
}
