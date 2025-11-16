import { useState } from "react";
import { ExternalLink, GitBranch, Calendar } from "lucide-react";
import { useReleases } from "@/hooks/useReleases";
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

export function Releases() {
  const [selectedChain, setSelectedChain] = useState<string | undefined>();
  const [limit, setLimit] = useState(20);

  const { data: releases, isLoading } = useReleases({
    chain: selectedChain,
    limit,
  });
  const { data: chains } = useChains();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Client Releases</h1>
        <p className="text-muted-foreground">
          Latest client software releases for monitored chains
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
            {[10, 20, 50].map((l) => (
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
          <div className="text-muted-foreground">Loading releases...</div>
        </div>
      ) : releases && releases.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {releases.map((release) => (
            <Card key={release.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{release.tag}</CardTitle>
                    <CardDescription>{release.repo}</CardDescription>
                  </div>
                  <a
                    href={release.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <span className="font-medium">{release.chain_name}</span>
                </div>

                {release.fork_name && <Badge>{release.fork_name}</Badge>}

                {release.activation_ts && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Activation:{" "}
                      {new Date(release.activation_ts).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Published:{" "}
                  {new Date(release.published_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No releases found
        </div>
      )}
    </div>
  );
}
