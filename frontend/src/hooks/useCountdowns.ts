import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCountdowns() {
  return useQuery({
    queryKey: ['countdowns'],
    queryFn: () => api.countdowns.list(),
    refetchInterval: 30000,
  });
}

export function useCountdown(chainId: string) {
  return useQuery({
    queryKey: ['countdowns', chainId],
    queryFn: () => api.countdowns.get(chainId),
    refetchInterval: 30000,
  });
}

