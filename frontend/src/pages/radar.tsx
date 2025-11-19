import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { Activity, Calendar, Clock, ExternalLink, Info } from "lucide-react";
import { useUpgrades } from "@/hooks/useUpgrades";
import { useCountdowns } from "@/hooks/useCountdowns";
import { useReleases } from "@/hooks/useReleases";
import type { Countdown, Release, Upgrade } from "@/types/api";
import { RadarBackground } from "@/components/radar-background";
import type { RadarBlip } from "@/components/radar-background";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const DAY_IN_MS = 86_400_000;
const HOUR_IN_MS = 3_600_000;
const MINUTE_IN_MS = 60_000;

export function Radar() {
  const { data: scheduledUpgrades, isLoading: upgradesLoading } = useUpgrades({
    status: "scheduled",
  });

  const { data: countdowns, isLoading: countdownsLoading } = useCountdowns();
  const [isUpgradeHovered, setIsUpgradeHovered] = useState<string | null>(null);
  const upgradeLookup = useMemo(() => {
    const map = new Map<string, Upgrade>();
    (scheduledUpgrades ?? []).forEach((upgrade) => {
      map.set(`${upgrade.chain_id}-${upgrade.fork_name}`, upgrade);
    });
    return map;
  }, [scheduledUpgrades]);

  const countdownDetails = useMemo(() => {
    if (!countdowns) return [];
    return [...countdowns]
      .sort(
        (a, b) =>
          new Date(a.target_ts).getTime() - new Date(b.target_ts).getTime()
      )
      .map((countdown) => ({
        countdown,
        upgrade: upgradeLookup.get(
          `${countdown.chain_id}-${countdown.fork_name}`
        ),
      }));
  }, [countdowns, upgradeLookup]);

  const orderedUpgrades = useMemo(() => {
    if (!scheduledUpgrades) return [];
    return [...scheduledUpgrades].sort((a, b) => {
      const aTs = a.activation_ts
        ? new Date(a.activation_ts).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bTs = b.activation_ts
        ? new Date(b.activation_ts).getTime()
        : Number.MAX_SAFE_INTEGER;

      return aTs - bTs;
    });
  }, [scheduledUpgrades]);

  const isBrowser =
    typeof window !== "undefined" && typeof document !== "undefined";

  const radarBlips = useMemo<RadarBlip[]>(() => {
    if (countdownDetails.length === 0) return [];
    return countdownDetails.slice(0, 8).map(({ countdown }) => {
      const { radius, intensity } = computeBlipDynamics(countdown);
      return {
        id: `${countdown.chain_id}-${countdown.fork_name}`,
        angle: hashAngle(`${countdown.chain_id}-${countdown.fork_name}`),
        radius,
        intensity,
        label: countdown.fork_name,
      };
    });
  }, [countdownDetails]);

  if (upgradesLoading || countdownsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading radar…</div>
      </div>
    );
  }

  return (
    <>
      {isBrowser &&
        createPortal(
          <RadarBackground
            blips={radarBlips}
            className="fixed inset-0 -z-10 flex items-center justify-center"
            focusedUpgrade={isUpgradeHovered}
          />,
          document.body
        )}
      <div className="relative space-y-12">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: isUpgradeHovered ? 0 : 1 }}
            exit={{ opacity: isUpgradeHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <section className="space-y-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                    Upgrade radar
                  </p>
                  <h1 className="text-4xl font-bold tracking-tight">
                    Track L1 and L2 upgrades
                  </h1>
                  <p className="text-base text-muted-foreground">
                    Live countdowns and links to client releases to stay
                    synchronized on chain upgrades.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:w-1/2">
                  <StatCard
                    label="Active countdowns"
                    value={countdownDetails.length}
                    icon={<Clock className="h-5 w-5 text-primary" />}
                    helper="Chains entering an activation window"
                  />
                  <StatCard
                    label="Scheduled upgrades"
                    value={orderedUpgrades.length}
                    icon={<Activity className="h-5 w-5 text-primary" />}
                    helper="Forks with confirmed timelines"
                  />
                </div>
              </div>

              <div className="space-y-6">
                {countdownDetails.length > 0 ? (
                  countdownDetails.map(({ countdown, upgrade }) => (
                    <CountdownShowcase
                      key={`${countdown.chain_id}-${countdown.fork_name}`}
                      countdown={countdown}
                      upgrade={upgrade}
                    />
                  ))
                ) : (
                  <Card className="border-dashed">
                    <CardHeader>
                      <CardTitle>No active countdowns</CardTitle>
                      <CardDescription>
                        We&apos;ll promote the next upgrade window here as soon
                        as a precise target is available.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>
            </section>
          </motion.div>
        </AnimatePresence>
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">
              Scheduled upgrades
            </h2>
            <p className="text-muted-foreground">
              Open any card to review the requirements and the latest client
              releases tied to that fork.
            </p>
          </div>
          {orderedUpgrades.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {orderedUpgrades.map((upgrade) => (
                <ScheduledUpgradeCard
                  key={upgrade.id}
                  upgrade={upgrade}
                  isUpgradeHovered={isUpgradeHovered}
                  setIsUpgradeHovered={setIsUpgradeHovered}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>No scheduled upgrades</CardTitle>
                <CardDescription>
                  We&apos;ll surface new forks here once timelines are
                  confirmed.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </section>
      </div>
    </>
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
    <Card className="border-primary/10 bg-background">
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

interface CountdownShowcaseProps {
  countdown: Countdown;
  upgrade?: Upgrade;
}

function computeBlipDynamics(countdown: Countdown) {
  const target = new Date(countdown.target_ts).getTime();
  const windowLow = new Date(countdown.window_low_ts).getTime();
  const totalSpan = Math.max(target - windowLow, HOUR_IN_MS);
  const remaining = Math.max(target - Date.now(), 0);
  const progress = 1 - Math.min(Math.max(remaining / totalSpan, 0), 1);
  const radius = 12 + (1 - progress) * 40; // shrink toward center as target nears
  const intensity = 0.4 + progress * 0.6;
  return { radius, intensity };
}

function hashAngle(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const normalized = (hash >>> 0) / 0xffffffff;
  return normalized * Math.PI * 2;
}

function CountdownShowcase({ countdown, upgrade }: CountdownShowcaseProps) {
  const timeParts = useLiveCountdown(countdown.target_ts);
  const reachedWindow = timeParts.totalMs === 0;

  const summary =
    upgrade?.source_summary ??
    "We are monitoring this fork for more implementation details.";

  const segments = [
    { label: "Days", value: padTimeUnit(timeParts.days) },
    { label: "Hours", value: padTimeUnit(timeParts.hours) },
    { label: "Minutes", value: padTimeUnit(timeParts.minutes) },
    { label: "Seconds", value: padTimeUnit(timeParts.seconds) },
  ];

  return (
    <Card className="overflow-hidden border-primary/20 bg-linear-to-br from-primary/5 via-background to-background shadow-lg">
      <CardHeader className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-widest text-primary">
          {upgrade?.chain_name ?? countdown.chain_id}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-3xl font-bold">
            {upgrade?.fork_name ?? countdown.fork_name}
          </CardTitle>
          {upgrade?.status && (
            <Badge variant="secondary" className="w-fit">
              {upgrade.status.replace("_", " ")}
            </Badge>
          )}
        </div>
        <CardDescription className="text-base">
          {reachedWindow
            ? "Upgrade window has started. Expect on-chain confirmations shortly."
            : `Live countdown for the ${
                upgrade?.fork_name ?? countdown.fork_name
              } upgrade window.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className={cn(
                "rounded-lg border bg-background/70 p-4 text-center",
                reachedWindow && "opacity-70"
              )}
            >
              <div className="text-4xl font-bold tabular-nums text-foreground">
                {segment.value}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {segment.label}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <InfoTile
            label="Target activation"
            value={formatDateTime(countdown.target_ts)}
          />
          <InfoTile
            label="Window (low)"
            value={formatDateTime(countdown.window_low_ts)}
          />
          <InfoTile
            label="Window (high)"
            value={formatDateTime(countdown.window_high_ts)}
          />
        </div>

        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Info className="h-4 w-4 text-primary" />
            Mission focus
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/70 p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

interface ScheduledUpgradeCardProps {
  upgrade: Upgrade;
  isUpgradeHovered: string | null;
  setIsUpgradeHovered: (isUpgradeHovered: string | null) => void;
}

function ScheduledUpgradeCard({
  upgrade,
  setIsUpgradeHovered,
  isUpgradeHovered,
}: ScheduledUpgradeCardProps) {
  const [open, setOpen] = useState(false);

  const { data: releases, isLoading: releasesLoading } = useReleases(
    { chain: upgrade.chain_id, fork: upgrade.fork_name, limit: 5 },
    { enabled: open }
  );

  const keyPoints = upgrade.details?.keyPoints?.slice(0, 2) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Card
            onMouseEnter={() =>
              setIsUpgradeHovered(upgrade.fork_name.toString())
            }
            onMouseLeave={() => setIsUpgradeHovered(null)}
            className={cn(
              "h-full border-primary/10 transition hover:-translate-y-1 hover:border-primary/40 group-focus-visible:border-primary/60",
              isUpgradeHovered === upgrade.fork_name.toString() &&
                "border-2 border-primary"
            )}
          >
            {isUpgradeHovered === upgrade.fork_name.toString() && (
              <motion.div
                className=""
                initial={{ scale: 1.5, opacity: 1 }}
                animate={{ scale: 8, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 1 }}
              />
            )}
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-semibold">
                    {upgrade.fork_name}
                  </CardTitle>
                  <CardDescription>{upgrade.chain_name}</CardDescription>
                </div>
                <Badge variant="outline">
                  {upgrade.status.replace("_", " ")}
                </Badge>
              </div>
              {upgrade.activation_ts && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  {formatDateTime(upgrade.activation_ts)}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {upgrade.source_summary && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {upgrade.source_summary}
                </p>
              )}

              {keyPoints.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {keyPoints.map((point, index) => (
                    <li
                      key={`${upgrade.id}-point-${index}`}
                      className="flex items-start gap-2 text-muted-foreground"
                    >
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-sm font-semibold text-primary">
                View detailed plan →
              </p>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl space-y-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {upgrade.fork_name}
          </DialogTitle>
          <DialogDescription className="text-base">
            {upgrade.chain_name} • Status: {upgrade.status.replace("_", " ")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoTile
            label="Target activation"
            value={formatDateTime(upgrade.activation_ts)}
          />
          <InfoTile
            label="Last updated"
            value={formatDateTime(upgrade.last_updated_at)}
          />
        </div>

        {upgrade.details?.timeline?.upgradeDate && (
          <InfoTile
            label="Upgrade date"
            value={upgrade.details.timeline.upgradeDate}
          />
        )}

        {upgrade.source_summary && (
          <div className="rounded-lg border bg-background/80 p-4">
            <p className="text-sm font-semibold text-foreground">Summary</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {upgrade.source_summary}
            </p>
          </div>
        )}

        {upgrade.details?.requirements &&
          upgrade.details.requirements.length > 0 && (
            <div className="space-y-3 rounded-lg border bg-background/80 p-4">
              <p className="text-sm font-semibold text-foreground">
                Rollout considerations
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {upgrade.details.requirements.map((item, index) => (
                  <li
                    key={`${upgrade.id}-requirement-${index}`}
                    className="flex gap-2"
                  >
                    <span>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Relevant releases
          </p>
          <ReleasesList releases={releases} isLoading={releasesLoading} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ReleasesListProps {
  releases?: Release[];
  isLoading: boolean;
}

function ReleasesList({ releases, isLoading }: ReleasesListProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Fetching release artifacts…
      </p>
    );
  }

  if (!releases || releases.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No client releases linked to this fork yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {releases.map((release) => (
        <li
          key={release.id}
          className="flex flex-col gap-3 rounded-lg border bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-foreground">
              {release.repo} • {release.tag}
            </p>
            <p className="text-sm text-muted-foreground">
              Published {formatDateTime(release.published_at)}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={release.url} target="_blank" rel="noreferrer">
              View release
            </a>
            <ExternalLink className="h-4 w-4 ml-auto" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function useLiveCountdown(targetTs: string): CountdownParts {
  const [parts, setParts] = useState<CountdownParts>(() =>
    getCountdownParts(targetTs)
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setParts(getCountdownParts(targetTs));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [targetTs]);

  return parts;
}

function getCountdownParts(targetTs: string): CountdownParts {
  const target = new Date(targetTs).getTime();
  const now = Date.now();
  const totalMs = Math.max(target - now, 0);

  const days = Math.floor(totalMs / DAY_IN_MS);
  const hours = Math.floor((totalMs % DAY_IN_MS) / HOUR_IN_MS);
  const minutes = Math.floor((totalMs % HOUR_IN_MS) / MINUTE_IN_MS);
  const seconds = Math.floor((totalMs % MINUTE_IN_MS) / 1000);

  return { totalMs, days, hours, minutes, seconds };
}

function padTimeUnit(value: number) {
  return value.toString().padStart(2, "0");
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "TBD";
  }
  return new Date(value).toLocaleString();
}
