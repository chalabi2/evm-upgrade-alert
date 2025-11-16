import { useState } from "react";
import { useUpgrades } from "@/hooks/useUpgrades";
import { useChains } from "@/hooks/useChains";
import { UpgradeCard } from "@/components/upgrade-card";
import { Button } from "@/components/ui/button";
import type { UpgradeStatus } from "@/types/api";

const statuses: UpgradeStatus[] = [
  "proposed",
  "approved",
  "scheduled",
  "queued",
  "executed",
  "canceled",
  "release_posted",
  "announced",
];

export function Upgrades() {
  const [selectedStatus, setSelectedStatus] = useState<
    UpgradeStatus | undefined
  >("scheduled");
  const [selectedChain, setSelectedChain] = useState<string | undefined>();

  const { data: upgrades, isLoading } = useUpgrades({
    status: selectedStatus,
    chain: selectedChain,
  });
  const { data: chains } = useChains();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Upgrades</h1>
        <p className="text-muted-foreground">
          Browse and filter chain upgrades by status and network
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedStatus === undefined ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus(undefined)}
            >
              All
            </Button>
            {statuses.map((status) => (
              <Button
                key={status}
                variant={selectedStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus(status)}
              >
                {status.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>

        {chains && chains.length > 0 && (
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
              {chains.map((chain) => (
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
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading upgrades...</div>
        </div>
      ) : upgrades && upgrades.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {upgrades.map((upgrade) => (
            <UpgradeCard key={upgrade.id} upgrade={upgrade} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No upgrades found with the selected filters
        </div>
      )}
    </div>
  );
}
