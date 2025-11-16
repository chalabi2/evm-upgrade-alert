import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useChains() {
  return useQuery({
    queryKey: ['chains'],
    queryFn: () => api.chains.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useChain(chainId: string) {
  return useQuery({
    queryKey: ['chains', chainId],
    queryFn: () => api.chains.get(chainId),
    staleTime: 5 * 60 * 1000,
  });
}

