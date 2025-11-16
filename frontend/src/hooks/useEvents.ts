import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useEvents(params?: { chain?: string; limit?: number }) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => api.events.list(params),
    refetchInterval: 60000,
  });
}

