import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Globe, Layers, Map, Zap } from 'lucide-react';
import { useChains } from '@/hooks/useChains';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Chain } from '@/types/api';

export function Chains() {
  const { data: chains, isLoading } = useChains();

  const stats = useMemo(() => {
    if (!chains) {
      return { total: 0, layerTwos: 0, families: 0 };
    }
    const layerTwos = chains.filter((chain) => chain.type === 'L2').length;
    const families = new Set(chains.map((chain) => chain.family)).size;
    return { total: chains.length, layerTwos, families };
  }, [chains]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading chains…</div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="space-y-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Network overview
            </p>
            <h1 className="text-4xl font-bold tracking-tight">
              Every monitored EVM network, one grid
            </h1>
            <p className="text-base text-muted-foreground">
              Use this roster to understand each chain&apos;s cadence, slot
              timing, and lineage before an upgrade cycle.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:w-1/2">
            <StatCard
              label="Chains tracked"
              value={stats.total}
              helper="Active in the registry"
              icon={<Globe className="h-5 w-5 text-primary" />}
            />
            <StatCard
              label="Layer 2s"
              value={stats.layerTwos}
              helper="Rollups + OP Stack"
              icon={<Layers className="h-5 w-5 text-primary" />}
            />
            <StatCard
              label="Families"
              value={stats.families}
              helper="Network lineages"
              icon={<Map className="h-5 w-5 text-primary" />}
            />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">Chain dossier</h2>
          <p className="text-muted-foreground">
            Each card highlights timing data and genesis info so you can plan
            upgrades with confidence.
          </p>
        </div>

        {chains && chains.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {chains.map((chain) => (
              <ChainCard key={chain.id} chain={chain} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No chains found</CardTitle>
              <CardDescription>
                The registry is empty. Try refreshing once new data is synced.
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

function ChainCard({ chain }: { chain: Chain }) {
  return (
    <Card className="h-full border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold">{chain.name}</CardTitle>
            <CardDescription>{chain.id}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="uppercase">
              {chain.type}
            </Badge>
            <Badge>{chain.family}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm">
          {chain.genesis_unix && (
            <div>
              <dt className="text-muted-foreground">Genesis</dt>
              <dd className="font-semibold">
                {new Date(chain.genesis_unix * 1000).toLocaleDateString()}
              </dd>
            </div>
          )}
          {chain.slot_seconds && (
            <div>
              <dt className="text-muted-foreground">Slot time</dt>
              <dd className="font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                {chain.slot_seconds}s
              </dd>
            </div>
          )}
          {chain.slots_per_epoch && (
            <div>
              <dt className="text-muted-foreground">Slots per epoch</dt>
              <dd className="font-semibold">{chain.slots_per_epoch}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

