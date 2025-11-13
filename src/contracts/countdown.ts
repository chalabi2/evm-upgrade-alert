export type EpochParams = {
  genesisUnix: number;
  slotSeconds: number;
  slotsPerEpoch: number;
  activationEpoch: number;
};

export function epochToUnix(p: EpochParams): number {
  const slotsFromGenesis = p.activationEpoch * p.slotsPerEpoch;
  return p.genesisUnix + slotsFromGenesis * p.slotSeconds;
}

export type CountdownWindow = {
  targetUnix: number;
  windowLowUnix?: number;
  windowHighUnix?: number;
  confidence: number;
};

export function epochCountdownWindow(p: EpochParams, missedSlotsBuffer = 32): CountdownWindow {
  const core = epochToUnix(p);
  const delta = missedSlotsBuffer * p.slotSeconds;
  return {
    targetUnix: core,
    windowLowUnix: core - delta,
    windowHighUnix: core + delta,
    confidence: 0.9
  };
}

export function timestampCountdown(targetUnix: number, jitterSeconds = 0): CountdownWindow {
  return {
    targetUnix,
    windowLowUnix: jitterSeconds ? targetUnix - jitterSeconds : undefined,
    windowHighUnix: jitterSeconds ? targetUnix + jitterSeconds : undefined,
    confidence: 0.95
  };
}
