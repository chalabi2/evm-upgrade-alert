import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { Webhook, Bell, Lock } from "lucide-react";
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
    value: "chain_events",
    label: "Chain events",
    description:
      "On-chain timelock executions, contract events, validator notices.",
  },
  {
    value: "releases",
    label: "Client releases",
    description: "New client versions and release announcements.",
  },
];

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
    chainId: "",
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

  const canSubmit = selectedChannels.length > 0 && !mutation.isPending;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedChannels.length === 0) {
      return;
    }

    const payload: AlertSubscriptionRequest = {
      user_id: formState.userId || undefined,
      chain_id: formState.chainId || undefined,
      fork_filter: formState.forkFilter || undefined,
      channels: selectedChannels,
      stages: selectedStages.length ? selectedStages : undefined,
      alert_types: selectedAlertTypes.length ? selectedAlertTypes : undefined,
      discord_webhook: formState.discordWebhook || undefined,
      slack_webhook: formState.slackWebhook || undefined,
      telegram_bot_token: formState.telegramBotToken || undefined,
      telegram_chat_id: formState.telegramChatId || undefined,
    };

    mutation.mutate(payload);
  };

  const subscriptionEcho = useMemo(() => {
    if (!mutation.data?.subscription) return null;
    return JSON.stringify(mutation.data.subscription, null, 2);
  }, [mutation.data]);

  return (
    <>
      {isBrowser &&
        createPortal(
          <AlertsBackground className="fixed inset-0 -z-10" />,
          document.body
        )}
      <div className="relative space-y-12">
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
                    description="Limit alerts to one chain. Leave blank for all."
                  >
                    <select
                      className="form-input"
                      value={formState.chainId}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          chainId: e.target.value,
                        }))
                      }
                    >
                      <option value="">All chains</option>
                      {chains?.map((chain) => (
                        <option key={chain.id} value={chain.id}>
                          {chain.name}
                        </option>
                      ))}
                    </select>
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
                          {channel.id === "discord" && (
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
                            />
                          )}
                          {channel.id === "slack" && (
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
                            />
                          )}
                          {channel.id === "telegram" && (
                            <div className="space-y-3">
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
                              />
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
                              />
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
                  <Button type="submit" disabled={!canSubmit}>
                    {mutation.isPending ? "Saving..." : "Save alert channels"}
                  </Button>
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
