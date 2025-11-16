import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UpgradeStatus } from '@/types/api';

export function useUpgrades(params?: { status?: UpgradeStatus; chain?: string }) {
  return useQuery({
    queryKey: ['upgrades', params],
    queryFn: () => api.upgrades.list(params),
  });
}

export function useUpgradesByChain(chainId: string) {
  return useQuery({
    queryKey: ['upgrades', 'chain', chainId],
    queryFn: () => api.upgrades.getByChain(chainId),
  });
}

