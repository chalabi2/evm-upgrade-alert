import { useChains } from '@/hooks/useChains';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function Chains() {
  const { data: chains, isLoading } = useChains();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading chains...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Chains</h1>
        <p className="text-muted-foreground">
          Overview of all monitored EVM chains
        </p>
      </div>

      {chains && chains.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chains.map((chain) => (
            <Card key={chain.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{chain.name}</CardTitle>
                    <CardDescription>{chain.id}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{chain.type}</Badge>
                    <Badge>{chain.family}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  {chain.genesis_unix && (
                    <div>
                      <dt className="text-muted-foreground">Genesis</dt>
                      <dd className="font-medium">
                        {new Date(chain.genesis_unix * 1000).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                  {chain.slot_seconds && (
                    <div>
                      <dt className="text-muted-foreground">Slot Time</dt>
                      <dd className="font-medium">{chain.slot_seconds}s</dd>
                    </div>
                  )}
                  {chain.slots_per_epoch && (
                    <div>
                      <dt className="text-muted-foreground">Slots per Epoch</dt>
                      <dd className="font-medium">{chain.slots_per_epoch}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No chains found
        </div>
      )}
    </div>
  );
}

