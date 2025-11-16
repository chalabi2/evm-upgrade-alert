import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useEvents } from "@/hooks/useEvents";
import { useChains } from "@/hooks/useChains";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Events() {
  const [selectedChain, setSelectedChain] = useState<string | undefined>();
  const [limit, setLimit] = useState(50);

  const { data: events, isLoading } = useEvents({
    chain: selectedChain,
    limit,
  });
  const { data: chains } = useChains();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">On-Chain Events</h1>
        <p className="text-muted-foreground">
          Recent governance and upgrade events detected on-chain
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Chain</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedChain === undefined ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedChain(undefined)}
            >
              All Chains
            </Button>
            {chains?.map((chain) => (
              <Button
                key={chain.id}
                variant={selectedChain === chain.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedChain(chain.id)}
              >
                {chain.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Limit</label>
          <div className="flex gap-2">
            {[20, 50, 100].map((l) => (
              <Button
                key={l}
                variant={limit === l ? "default" : "outline"}
                size="sm"
                onClick={() => setLimit(l)}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading events...</div>
        </div>
      ) : events && events.length > 0 ? (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {event.event_name}
                    </CardTitle>
                    <CardDescription>
                      {event.chain_name} • Block{" "}
                      {event.block_number.toLocaleString()}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {new Date(event.occurred_at).toLocaleString()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                  <span className="truncate">{event.tx_hash}</span>
                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-primary" />
                </div>

                {Object.keys(event.args).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Arguments</div>
                    <div className="rounded-md bg-muted p-3 font-mono text-xs">
                      <pre className="overflow-x-auto">
                        {JSON.stringify(event.args, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Contract: <span className="font-mono">{event.address}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No events found
        </div>
      )}
    </div>
  );
}
