import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useReleases(params?: { chain?: string; fork?: string; limit?: number }) {
  return useQuery({
    queryKey: ['releases', params],
    queryFn: () => api.releases.list(params),
  });
}

