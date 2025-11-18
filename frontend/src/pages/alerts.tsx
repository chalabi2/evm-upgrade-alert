import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { Webhook, Bell, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { useChains } from "@/hooks/useChains";
import { AlertsBackground } from "@/components/alerts-background";
import { cn } from "@/lib/utils";
import type {
  AlertSubscriptionRequest,
  AlertTopic,
  NotificationChannel,
  UpgradeStatus,
} from "@/types/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CHANNEL_OPTIONS: {
  id: NotificationChannel;
  title: string;
  description: string;
  helper?: string;
}[] = [
  {
    id: "discord",
    title: "Discord Webhook",
    description: "Send alerts into any Discord channel.",
  },
  {
    id: "slack",
    title: "Slack Webhook",
    description: "Post upgrade notices to Slack.",
  },
  {
    id: "telegram",
    title: "Telegram Bot",
    description: "Deliver alerts via Telegram bot/chat.",
    helper: "Requires a bot token + chat ID.",
  },
];

const STAGE_OPTIONS: { value: UpgradeStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "queued", label: "Queued" },
  { value: "executed", label: "Executed" },
  { value: "announced", label: "Announced" },
];

const ALERT_TYPE_OPTIONS: {
  value: AlertTopic;
  label: string;
  description: string;
}[] = [
  {
    value: "upgrades",
    label: "Upgrade milestones",
    description:
      "Major protocol forks, governance queue changes, L1/L2 upgrades.",
  },

  {
    value: "releases",
    label: "Client releases",
    description: "New client versions and release announcements.",
  },
];

const SCHEDULER_TIMEZONE =
  (import.meta.env.VITE_SCHEDULER_TZ as string | undefined) ??
  "America/Los_Angeles";
const SCHEDULER_HOUR = (() => {
  const raw = Number(
    (import.meta.env.VITE_SCHEDULER_HOUR as string | undefined) ?? "7"
  );
  const parsed = Number.isFinite(raw) ? raw : 7;
  return Math.min(Math.max(Math.floor(parsed), 0), 23);
})();
const SCHEDULER_MINUTE = (() => {
  const raw = Number(
    (import.meta.env.VITE_SCHEDULER_MINUTE as string | undefined) ?? "0"
  );
  const parsed = Number.isFinite(raw) ? raw : 0;
  return Math.min(Math.max(Math.floor(parsed), 0), 59);
})();

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type LocalDateTimeInput = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }
  return formatterCache.get(timeZone)!;
}

function extractZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Partial<Record<string, number>>;
  return {
    year: lookup.year ?? date.getUTCFullYear(),
    month: lookup.month ?? date.getUTCMonth() + 1,
    day: lookup.day ?? date.getUTCDate(),
    hour: lookup.hour ?? date.getUTCHours(),
    minute: lookup.minute ?? date.getUTCMinutes(),
    second: lookup.second ?? date.getUTCSeconds(),
  };
}

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = extractZonedParts(
    date,
    timeZone
  );
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  return asUTC - date.getTime();
}

function zonedTimeToUtc(local: LocalDateTimeInput, timeZone: string): Date {
  const utcBaseline = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
    0
  );
  const firstPass = new Date(utcBaseline);
  const initialOffset = getTimezoneOffsetMs(firstPass, timeZone);
  let adjusted = utcBaseline - initialOffset;
  const adjustedDate = new Date(adjusted);
  const adjustedOffset = getTimezoneOffsetMs(adjustedDate, timeZone);
  if (adjustedOffset !== initialOffset) {
    adjusted = utcBaseline - adjustedOffset;
  }
  return new Date(adjusted);
}

function getNextSchedulerRun(reference: Date): Date {
  const nowParts = extractZonedParts(reference, SCHEDULER_TIMEZONE);
  const todayRun = zonedTimeToUtc(
    {
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
      hour: SCHEDULER_HOUR,
      minute: SCHEDULER_MINUTE,
      second: 0,
    },
    SCHEDULER_TIMEZONE
  );

  if (todayRun.getTime() > reference.getTime()) {
    return todayRun;
  }

  return zonedTimeToUtc(
    {
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day + 1,
      hour: SCHEDULER_HOUR,
      minute: SCHEDULER_MINUTE,
      second: 0,
    },
    SCHEDULER_TIMEZONE
  );
}

export function Alerts() {
  const { data: chains } = useChains();
  const isBrowser =
    typeof window !== "undefined" && typeof document !== "undefined";

  const [selectedChannels, setSelectedChannels] = useState<
    NotificationChannel[]
  >(["discord"]);
  const [selectedStages, setSelectedStages] = useState<UpgradeStatus[]>([
    "scheduled",
  ]);
  const [selectedAlertTypes, setSelectedAlertTypes] = useState<AlertTopic[]>([
    "upgrades",
  ]);
  const [formState, setFormState] = useState({
    userId: "",
    chainIds: [] as string[],
    forkFilter: "",
    discordWebhook: "",
    slackWebhook: "",
    telegramBotToken: "",
    telegramChatId: "",
  });

  const mutation = useMutation({
    mutationFn: (payload: AlertSubscriptionRequest) =>
      api.alerts.subscribe(payload),
  });

  const isChannelSelected = (channel: NotificationChannel) =>
    selectedChannels.includes(channel);

  const toggleChannel = (channel: NotificationChannel) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const toggleStage = (stage: UpgradeStatus) => {
    setSelectedStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  const toggleAlertType = (type: AlertTopic) => {
    setSelectedAlertTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const trimmedDiscordWebhook = formState.discordWebhook.trim();
  const trimmedSlackWebhook = formState.slackWebhook.trim();
  const trimmedTelegramBotToken = formState.telegramBotToken.trim();
  const trimmedTelegramChatId = formState.telegramChatId.trim();

  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const isValidDiscordWebhook = (url: string): boolean => {
    return isValidUrl(url) && url.includes("discord.com/api/webhooks/");
  };

  const isValidSlackWebhook = (url: string): boolean => {
    return isValidUrl(url) && url.includes("hooks.slack.com/services/");
  };

  const isValidTelegramBotToken = (token: string): boolean => {
    return /^\d+:[A-Za-z0-9_-]+$/.test(token);
  };

  const isValidTelegramChatId = (chatId: string): boolean => {
    return /^-?\d+$/.test(chatId);
  };

  const channelErrors = {
    discord:
      isChannelSelected("discord") &&
      (trimmedDiscordWebhook.length === 0 ||
        !isValidDiscordWebhook(trimmedDiscordWebhook)),
    slack:
      isChannelSelected("slack") &&
      (trimmedSlackWebhook.length === 0 ||
        !isValidSlackWebhook(trimmedSlackWebhook)),
    telegramBotToken:
      isChannelSelected("telegram") &&
      (trimmedTelegramBotToken.length === 0 ||
        !isValidTelegramBotToken(trimmedTelegramBotToken)),
    telegramChatId:
      isChannelSelected("telegram") &&
      (trimmedTelegramChatId.length === 0 ||
        !isValidTelegramChatId(trimmedTelegramChatId)),
  };

  const hasChannelErrors = Object.values(channelErrors).some(Boolean);

  const canSubmit =
    selectedChannels.length > 0 && !mutation.isPending && !hasChannelErrors;

  const chainSelection = formState.chainIds;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedChannels.length === 0) {
      return;
    }

    const payload: AlertSubscriptionRequest = {
      user_id: formState.userId || undefined,
      chain_id: chainSelection.length === 1 ? chainSelection[0] : undefined,
      chain_ids: chainSelection.length > 1 ? chainSelection : undefined,
      fork_filter: formState.forkFilter || undefined,
      channels: selectedChannels,
      stages: selectedStages.length ? selectedStages : undefined,
      alert_types: selectedAlertTypes.length ? selectedAlertTypes : undefined,
      discord_webhook: trimmedDiscordWebhook || undefined,
      slack_webhook: trimmedSlackWebhook || undefined,
      telegram_bot_token: trimmedTelegramBotToken || undefined,
      telegram_chat_id: trimmedTelegramChatId || undefined,
    };

    mutation.mutate(payload);
  };

  const subscriptionEcho = useMemo(() => {
    if (!mutation.data?.subscription) return null;
    return JSON.stringify(mutation.data.subscription, null, 2);
  }, [mutation.data]);

  const selectedChainLabel = useMemo(() => {
    if (formState.chainIds.length === 0) {
      return "All chains";
    }

    if (formState.chainIds.length === 1) {
      const chainId = formState.chainIds[0];
      return chains?.find((chain) => chain.id === chainId)?.name ?? chainId;
    }

    return `${formState.chainIds.length} chains selected`;
  }, [chains, formState.chainIds]);

  return (
    <>
      {isBrowser &&
        createPortal(
          <AlertsBackground className="fixed inset-0 -z-10" />,
          document.body
        )}
      <div className="relative space-y-8">
        <section className="space-y-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                Alert routing
              </p>
              <h1 className="text-4xl font-bold tracking-tight">
                Upgrade Radar Alerts
              </h1>
              <p className="text-base text-muted-foreground">
                Plug in Discord, Slack, or Telegram destinations. We encrypt
                every token before storing it and only use them when an alert is
                ready to broadcast.
              </p>
            </div>
            <SchedulerCountdown />
          </div>
        </section>

        <section className="space-y-8">
          <Card className="border-primary/20 bg-background/90 shadow-xl">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-semibold">
                Destinations
              </CardTitle>
              <CardDescription>
                Choose the channels we should hit for each upgrade milestone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-8" onSubmit={handleSubmit}>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Field
                    label="Contact label"
                    description="Optional reference so you can find this later."
                  >
                    <input
                      className="form-input"
                      placeholder="core-team-runbook"
                      value={formState.userId}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          userId: e.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field
                    label="Chain filter"
                    description="Leave blank for all chains or pick any combination."
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full h-9">
                          {selectedChainLabel}
                          <ChevronDown className="h-4 w-4 ml-auto" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-64">
                        <DropdownMenuLabel>Select Chains</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={formState.chainIds.length === 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormState((prev) => ({
                                ...prev,
                                chainIds: [],
                              }));
                            }
                          }}
                        >
                          All chains
                        </DropdownMenuCheckboxItem>
                        {chains?.map((chain) => (
                          <DropdownMenuCheckboxItem
                            key={chain.id}
                            checked={formState.chainIds.includes(chain.id)}
                            onCheckedChange={(checked) =>
                              setFormState((prev) => {
                                const nextIds = checked
                                  ? [...prev.chainIds, chain.id]
                                  : prev.chainIds.filter(
                                      (id) => id !== chain.id
                                    );
                                return { ...prev, chainIds: nextIds };
                              })
                            }
                          >
                            {chain.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Field>

                  <Field
                    label="Fork name filter"
                    description="Send alerts only for forks that match this text."
                    className="lg:col-span-2"
                  >
                    <input
                      className="form-input"
                      placeholder="deneb, fusaka..."
                      value={formState.forkFilter}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          forkFilter: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Field
                    label="Upgrade stages"
                    description="Pick the states that should trigger an alert."
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {STAGE_OPTIONS.map((stage) => (
                        <label
                          key={stage.value}
                          className="flex items-start gap-2 rounded-lg border border-input/60 bg-background/60 p-3 text-sm"
                        >
                          <Checkbox
                            checked={selectedStages.includes(stage.value)}
                            onCheckedChange={() => toggleStage(stage.value)}
                          />
                          <span className="flex-1">{stage.label}</span>
                        </label>
                      ))}
                    </div>
                  </Field>

                  <Field
                    label="Alert focus"
                    description="Pick the type of notifications you want to receive."
                  >
                    <div className="space-y-2">
                      {ALERT_TYPE_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-start gap-3 rounded-lg border border-input/60 bg-background/60 p-3 text-sm"
                        >
                          <Checkbox
                            checked={selectedAlertTypes.includes(option.value)}
                            onCheckedChange={() =>
                              toggleAlertType(option.value)
                            }
                          />
                          <div>
                            <p className="font-semibold">{option.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {option.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Channels</h2>
                  <p className="text-sm text-muted-foreground">
                    Enable every destination you want and drop the appropriate
                    webhook credentials.
                  </p>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {CHANNEL_OPTIONS.map((channel) => (
                      <div
                        key={channel.id}
                        className="rounded-xl border border-primary/15 bg-muted/20 p-4"
                      >
                        <label className="flex items-start gap-3">
                          <Checkbox
                            checked={isChannelSelected(channel.id)}
                            onCheckedChange={() => toggleChannel(channel.id)}
                          />
                          <div className="space-y-1">
                            <p className="text-base font-semibold">
                              {channel.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {channel.description}
                            </p>
                            {channel.helper && (
                              <p className="text-xs text-muted-foreground/70">
                                {channel.helper}
                              </p>
                            )}
                          </div>
                        </label>

                        <div className="mt-4 space-y-3">
                          {channel.id === "discord" &&
                            isChannelSelected("discord") && (
                              <div className="space-y-2">
                                <input
                                  className="form-input"
                                  placeholder="https://discord.com/api/webhooks/..."
                                  value={formState.discordWebhook}
                                  onChange={(e) =>
                                    setFormState((prev) => ({
                                      ...prev,
                                      discordWebhook: e.target.value,
                                    }))
                                  }
                                  aria-invalid={channelErrors.discord}
                                />
                                {channelErrors.discord && (
                                  <p className="text-xs text-destructive">
                                    {trimmedDiscordWebhook.length === 0
                                      ? "Discord channel requires a webhook URL."
                                      : "Invalid Discord webhook URL. Must be https://discord.com/api/webhooks/..."}
                                  </p>
                                )}
                              </div>
                            )}
                          {channel.id === "slack" &&
                            isChannelSelected("slack") && (
                              <div className="space-y-2">
                                <input
                                  className="form-input"
                                  placeholder="https://hooks.slack.com/services/..."
                                  value={formState.slackWebhook}
                                  onChange={(e) =>
                                    setFormState((prev) => ({
                                      ...prev,
                                      slackWebhook: e.target.value,
                                    }))
                                  }
                                  aria-invalid={channelErrors.slack}
                                />
                                {channelErrors.slack && (
                                  <p className="text-xs text-destructive">
                                    {trimmedSlackWebhook.length === 0
                                      ? "Slack channel requires an incoming webhook URL."
                                      : "Invalid Slack webhook URL. Must be https://hooks.slack.com/services/..."}
                                  </p>
                                )}
                              </div>
                            )}
                          {channel.id === "telegram" &&
                            isChannelSelected("telegram") && (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <input
                                    className="form-input"
                                    placeholder="Bot token (e.g. 1234:ABC)"
                                    value={formState.telegramBotToken}
                                    onChange={(e) =>
                                      setFormState((prev) => ({
                                        ...prev,
                                        telegramBotToken: e.target.value,
                                      }))
                                    }
                                    aria-invalid={
                                      channelErrors.telegramBotToken
                                    }
                                  />
                                  {channelErrors.telegramBotToken && (
                                    <p className="text-xs text-destructive">
                                      {trimmedTelegramBotToken.length === 0
                                        ? "Bot token is required."
                                        : "Invalid bot token format. Expected: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <input
                                    className="form-input"
                                    placeholder="Chat ID (e.g. -100123456789)"
                                    value={formState.telegramChatId}
                                    onChange={(e) =>
                                      setFormState((prev) => ({
                                        ...prev,
                                        telegramChatId: e.target.value,
                                      }))
                                    }
                                    aria-invalid={channelErrors.telegramChatId}
                                  />
                                  {channelErrors.telegramChatId && (
                                    <p className="text-xs text-destructive">
                                      {trimmedTelegramChatId.length === 0
                                        ? "Chat ID is required."
                                        : "Invalid chat ID format. Must be a number (e.g. -100123456789)"}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Webhook className="h-4 w-4 text-primary" />
                    We fan-out every alert to all configured channels, including
                    our internal Discord.
                  </p>
                  <div className="flex flex-col gap-2 sm:items-end">
                    {mutation.isSuccess && !mutation.isPending && (
                      <p className="text-sm text-primary">
                        Subscription saved. Review the payload echo below.
                      </p>
                    )}
                    <Button type="submit" disabled={!canSubmit}>
                      {mutation.isPending ? "Saving..." : "Save alert channels"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-muted/30">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Bell className="h-5 w-5 text-primary" />
                Subscription echo
              </CardTitle>
              <CardDescription>
                Responses are echoed back from the API so you can confirm
                exactly what we stored.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mutation.isError && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                  {(mutation.error as Error)?.message ??
                    "Unable to save subscription."}
                </div>
              )}
              {subscriptionEcho ? (
                <pre className="rounded-lg bg-background/80 p-4 text-left text-xs text-muted-foreground shadow-inner">
                  {subscriptionEcho}
                </pre>
              ) : (
                <div className="rounded-lg border border-dashed border-primary/20 p-6 text-center text-sm text-muted-foreground">
                  Submit at least one destination to preview the payload we
                  store.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}

interface FieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

function Field({ label, description, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function SchedulerCountdown() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const nextRun = useMemo(() => getNextSchedulerRun(now), [now]);
  const diffMs = Math.max(nextRun.getTime() - now.getTime(), 0);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const countdown = [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
  const nextRunLabel = nextRun.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: undefined,
    timeZoneName: "short",
  });

  return (
    <div className="rounded-xl border border-primary/20 bg-background/90 p-4 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Next Scan
          </p>
          <p className="text-sm text-muted-foreground">{nextRunLabel}</p>
        </div>
        <p className="font-mono text-2xl font-bold tabular-nums text-primary">
          {countdown}
        </p>
      </div>
    </div>
  );
}
