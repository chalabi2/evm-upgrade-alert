import { AlertCircle, Clock, TrendingUp } from "lucide-react";
import { useUpgrades } from "@/hooks/useUpgrades";
import { useCountdowns } from "@/hooks/useCountdowns";
import { CountdownTimer } from "@/components/countdown-timer";
import { UpgradeCard } from "@/components/upgrade-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function Dashboard() {
  const { data: scheduledUpgrades, isLoading: upgradesLoading } = useUpgrades({
    status: "scheduled",
  });
  const { data: countdowns, isLoading: countdownsLoading } = useCountdowns();

  if (upgradesLoading || countdownsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor upcoming EVM chain upgrades and network changes
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Scheduled Upgrades
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {scheduledUpgrades?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active countdown timers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Countdowns
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {countdowns?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Chains with upcoming forks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Confidence
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {scheduledUpgrades && scheduledUpgrades.length > 0
                ? Math.round(
                    (scheduledUpgrades.reduce(
                      (acc, u) => acc + u.confidence,
                      0
                    ) /
                      scheduledUpgrades.length) *
                      100
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Across all upgrades</p>
          </CardContent>
        </Card>
      </div>

      {countdowns && countdowns.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Active Countdowns
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {countdowns.map((countdown) => (
              <CountdownTimer key={countdown.chain_id} countdown={countdown} />
            ))}
          </div>
        </div>
      )}

      {scheduledUpgrades && scheduledUpgrades.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Scheduled Upgrades
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scheduledUpgrades.map((upgrade) => (
              <UpgradeCard key={upgrade.id} upgrade={upgrade} />
            ))}
          </div>
        </div>
      )}

      {(!scheduledUpgrades || scheduledUpgrades.length === 0) &&
        (!countdowns || countdowns.length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle>No Scheduled Upgrades</CardTitle>
              <CardDescription>
                There are currently no scheduled upgrades. Check back later for
                updates.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
    </div>
  );
}
