import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ExternalLink, GitBranch, Radio, Tag } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useChains } from '@/hooks/useChains';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FilterToolbar } from '@/components/filter-toolbar';
import { FilterOperator, FilterType } from '@/components/ui/filters';
import type { Filter, FilterOption } from '@/components/ui/filters';
import type { OnChainEvent } from '@/types/api';

export function Events() {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: allEvents, isLoading } = useEvents({ limit: 1000 });
  const { data: chains } = useChains();

  const chainOptions: FilterOption[] = useMemo(
    () =>
      chains
        ?.filter((chain) => chain.chain_id !== null)
        .map((chain) => ({
          name: chain.name,
          icon: <GitBranch className="size-3.5" />,
          label: chain.chain_id!.toString(),
        })) ?? [],
    [chains]
  );

  const eventTypeOptions: FilterOption[] = useMemo(() => {
    if (!allEvents) return [];
    const uniqueEventTypes = Array.from(
      new Set(allEvents.map((event) => event.event_name))
    );
    return uniqueEventTypes.map((eventType) => ({
      name: eventType,
      icon: <Tag className="size-3.5" />,
    }));
  }, [allEvents]);

  const filterConfig = useMemo(
    () => ({
      filterViewOptions: [
        [
          { name: FilterType.CHAIN, icon: <GitBranch className="size-3.5" /> },
          { name: FilterType.EVENT_TYPE, icon: <Tag className="size-3.5" /> },
        ],
      ],
      filterOptionsMap: {
        [FilterType.STATUS]: [],
        [FilterType.CHAIN]: chainOptions,
        [FilterType.EVENT_TYPE]: eventTypeOptions,
        [FilterType.CREATED_DATE]: [],
        [FilterType.PUBLISHED_DATE]: [],
        [FilterType.ACTIVATION_DATE]: [],
      },
    }),
    [chainOptions, eventTypeOptions]
  );

  const filteredEvents = useMemo(() => {
    if (!allEvents) return [];

    return allEvents.filter((event) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.event_name.toLowerCase().includes(query) ||
          event.chain_name.toLowerCase().includes(query) ||
          event.tx_hash.toLowerCase().includes(query) ||
          event.address.toLowerCase().includes(query) ||
          event.block_number.toString().includes(query);

        if (!matchesSearch) return false;
      }

      for (const filter of filters) {
        if (filter.value.length === 0) continue;

        if (filter.type === FilterType.CHAIN) {
          const selectedChainNames = filter.value;
          const eventChain = chains?.find((c) => c.id === event.chain_id);
          if (!eventChain) return false;

          const chainMatch =
            filter.operator === FilterOperator.IS
              ? selectedChainNames.includes(eventChain.name)
              : filter.operator === FilterOperator.IS_NOT
              ? !selectedChainNames.includes(eventChain.name)
              : filter.operator === FilterOperator.IS_ANY_OF
              ? selectedChainNames.includes(eventChain.name)
              : filter.operator === FilterOperator.EXCLUDE_IF_ANY_OF
              ? !selectedChainNames.includes(eventChain.name)
              : true;

          if (!chainMatch) return false;
        }

        if (filter.type === FilterType.EVENT_TYPE) {
          const eventTypeMatch =
            filter.operator === FilterOperator.IS
              ? filter.value.includes(event.event_name)
              : filter.operator === FilterOperator.IS_NOT
              ? !filter.value.includes(event.event_name)
              : filter.operator === FilterOperator.IS_ANY_OF
              ? filter.value.includes(event.event_name)
              : filter.operator === FilterOperator.EXCLUDE_IF_ANY_OF
              ? !filter.value.includes(event.event_name)
              : true;

          if (!eventTypeMatch) return false;
        }
      }

      return true;
    });
  }, [allEvents, filters, searchQuery, chains]);

  const totalEvents = allEvents?.length ?? 0;
  const chainsCovered = new Set(
    (allEvents ?? []).map((event) => event.chain_name)
  ).size;
  const eventTypes = new Set(
    (allEvents ?? []).map((event) => event.event_name)
  ).size;

  return (
    <div className="space-y-12">
      <section className="space-y-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Event intelligence
            </p>
            <h1 className="text-4xl font-bold tracking-tight">
              Monitor every governance pulse
            </h1>
            <p className="text-base text-muted-foreground">
              Filter the firehose of on-chain activity by chain, event type, or
              search key phrases.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:w-1/2">
            <StatCard
              label="Captured events"
              value={totalEvents}
              helper="Recent on-chain activity"
              icon={<Radio className="h-5 w-5 text-primary" />}
            />
            <StatCard
              label="Chains"
              value={chainsCovered}
              helper="Distinct networks detected"
              icon={<GitBranch className="h-5 w-5 text-primary" />}
            />
            <StatCard
              label="Event types"
              value={eventTypes}
              helper="Governance + upgrade signals"
              icon={<Tag className="h-5 w-5 text-primary" />}
            />
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Dial in the signals</CardTitle>
            <CardDescription>
              Combine precise filters with search to surface only the events
              that matter to your incident response.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FilterToolbar
              filters={filters}
              setFilters={setFilters}
              config={filterConfig}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search events, hashes, contracts..."
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Live event feed
          </h2>
          <p className="text-muted-foreground">
            We surface the freshest 50 events so you can triage without noise.
          </p>
        </div>

        {isLoading ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Loading events…</CardTitle>
              <CardDescription>
                Fetching the latest governance and upgrade logs.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : filteredEvents.length > 0 ? (
          <div className="space-y-4">
            {filteredEvents.slice(0, 50).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No events match</CardTitle>
              <CardDescription>
                Adjust your filters or broaden the search query.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  helper: string;
  icon: ReactNode;
}

function StatCard({ label, value, helper, icon }: StatCardProps) {
  return (
    <Card className="border-primary/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function EventCard({ event }: { event: OnChainEvent }) {
  const argsPresent = Object.keys(event.args).length > 0;

  return (
    <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              {event.chain_name}
            </p>
            <CardTitle className="text-2xl font-bold">
              {event.event_name}
            </CardTitle>
            <CardDescription>
              Block {event.block_number.toLocaleString()} • Contract{' '}
              <span className="font-mono">{event.address}</span>
            </CardDescription>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <Badge variant="outline">
              {new Date(event.occurred_at).toLocaleString()}
            </Badge>
            <a
              href={`https://etherscan.io/tx/${event.tx_hash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80"
            >
              Open transaction
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">Block #{event.block_number}</Badge>
          <Badge variant="outline">Tx {event.tx_hash.slice(0, 10)}…</Badge>
          <Badge variant="outline">Chain ID: {event.chain_id}</Badge>
        </div>

        {argsPresent && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground">
              Arguments
            </div>
            <div className="rounded-md border bg-background/80 p-3 font-mono text-xs leading-relaxed">
              <pre className="overflow-x-auto">
                {JSON.stringify(event.args, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

