import type {
  Chain,
  Upgrade,
  Countdown,
  OnChainEvent,
  Release,
  HealthResponse,
  UpgradeStatus,
  AlertSubscriptionRequest,
  AlertSubscriptionResponse,
} from '@/types/api';

const API_BASE_URL = 'https://backend.upgradar.xyz/';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  health: {
    check: () => fetchAPI<HealthResponse>('health'),
  },
  chains: {
    list: () => fetchAPI<Chain[]>('v1/chains'),
    get: (chainId: string) => fetchAPI<Chain>(`v1/chains/${chainId}`),
  },
  upgrades: {
    list: (params?: { status?: UpgradeStatus; chain?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.chain) searchParams.set('chain', params.chain);
      const query = searchParams.toString();
      return fetchAPI<Upgrade[]>(`v1/upgrades${query ? `?${query}` : ''}`);
    },
    getByChain: (chainId: string) =>
      fetchAPI<Upgrade[]>(`v1/upgrades/${chainId}`),
  },
  countdowns: {
    list: () => fetchAPI<Countdown[]>('v1/countdowns'),
    get: (chainId: string) => fetchAPI<Countdown>(`v1/countdowns/${chainId}`),
  },
  events: {
    list: (params?: { chain?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.chain) searchParams.set('chain', params.chain);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      const query = searchParams.toString();
      return fetchAPI<OnChainEvent[]>(`v1/events${query ? `?${query}` : ''}`);
    },
  },
  releases: {
    list: (params?: { chain?: string; fork?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.chain) searchParams.set('chain', params.chain);
      if (params?.fork) searchParams.set('fork', params.fork);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      const query = searchParams.toString();
      return fetchAPI<Release[]>(`v1/releases${query ? `?${query}` : ''}`);
    },
  },
  alerts: {
    subscribe: (payload: AlertSubscriptionRequest) =>
      fetchAPI<AlertSubscriptionResponse>('v1/alerts/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
  },
};

