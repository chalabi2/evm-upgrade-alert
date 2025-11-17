import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Release } from '@/types/api';

type ReleasesQueryOptions = Partial<UseQueryOptions<Release[], Error>>;

export function useReleases(
  params?: { chain?: string; fork?: string; limit?: number },
  options?: ReleasesQueryOptions
) {
  return useQuery({
    queryKey: ['releases', params],
    queryFn: () => api.releases.list(params),
    ...options,
  });
}

