import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Calendar, ExternalLink, GitBranch, Layers } from "lucide-react";
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
import { FilterToolbar } from "@/components/filter-toolbar";
import { FilterOperator, FilterType } from "@/components/ui/filters";
import type { Filter, FilterOption } from "@/components/ui/filters";
import type { Release } from "@/types/api";
import { Button } from "@/components/ui/button";

export function Releases() {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allReleases, isLoading } = useReleases({ limit: 200 });
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

  const filterConfig = useMemo(
    () => ({
      filterViewOptions: [
        [
          {
            name: FilterType.CHAIN,
            icon: <GitBranch className="size-3.5" />,
          },
        ],
      ],
      filterOptionsMap: {
        [FilterType.STATUS]: [],
        [FilterType.CHAIN]: chainOptions,
        [FilterType.EVENT_TYPE]: [],
        [FilterType.CREATED_DATE]: [],
        [FilterType.PUBLISHED_DATE]: [],
        [FilterType.ACTIVATION_DATE]: [],
      },
    }),
    [chainOptions]
  );

  const filteredReleases = useMemo(() => {
    if (!allReleases || !chains) return [];

    return allReleases.filter((release) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          release.tag.toLowerCase().includes(query) ||
          release.repo.toLowerCase().includes(query) ||
          release.chain_name.toLowerCase().includes(query) ||
          release.fork_name?.toLowerCase().includes(query ?? "");

        if (!matchesSearch) return false;
      }

      for (const filter of filters) {
        if (filter.value.length === 0) continue;

        if (filter.type === FilterType.CHAIN) {
          const selectedChainNames = filter.value;
          const releaseChain = chains.find((c) => c.id === release.chain_id);

          if (!releaseChain) return false;

          const chainMatch =
            filter.operator === FilterOperator.IS
              ? selectedChainNames.includes(releaseChain.name)
              : filter.operator === FilterOperator.IS_NOT
              ? !selectedChainNames.includes(releaseChain.name)
              : filter.operator === FilterOperator.IS_ANY_OF
              ? selectedChainNames.includes(releaseChain.name)
              : filter.operator === FilterOperator.EXCLUDE_IF_ANY_OF
              ? !selectedChainNames.includes(releaseChain.name)
              : true;

          if (!chainMatch) return false;
        }
      }

      return true;
    });
  }, [allReleases, filters, searchQuery, chains]);

  const totalReleases = allReleases?.length ?? 0;
  const chainsCovered = new Set(
    (allReleases ?? []).map((release) => release.chain_name)
  ).size;
  const uniqueRepos = new Set(
    (allReleases ?? []).map((release) => release.repo)
  ).size;

  return (
    <div className="space-y-12">
      <section className="space-y-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Release radar
            </p>
            <h1 className="text-4xl font-bold tracking-tight">
              Track client drops per chain
            </h1>
            <p className="text-base text-muted-foreground">
              Filter client artifacts by chain, fork, or repository to align
              validators before every upgrade.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:w-1/2">
            <StatCard
              label="Published releases"
              value={totalReleases}
              helper="Latest 200 artifacts"
              icon={<Layers className="h-5 w-5 text-primary" />}
            />
            <StatCard
              label="Chains"
              value={chainsCovered}
              helper="Networks with fresh builds"
              icon={<GitBranch className="h-5 w-5 text-primary" />}
            />
            <StatCard
              label="Repositories"
              value={uniqueRepos}
              helper="Distinct client repos"
              icon={<ExternalLink className="h-5 w-5 text-primary" />}
            />
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Filter the release stream</CardTitle>
            <CardDescription>
              Combine chain filters with search to find the repo, fork, or tag
              you need.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FilterToolbar
              filters={filters}
              setFilters={setFilters}
              config={filterConfig}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search tags, repos, forks..."
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Latest artifacts
          </h2>
          <p className="text-muted-foreground">
            Click any card to jump directly to the official release notes.
          </p>
        </div>

        {isLoading ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Loading releases…</CardTitle>
              <CardDescription>
                Syncing the latest artifacts across monitored repos.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : filteredReleases.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredReleases.slice(0, 60).map((release) => (
              <ReleaseCard key={release.id} release={release} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No releases match</CardTitle>
              <CardDescription>
                Broaden your filters or clear the search query.
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

function ReleaseCard({ release }: { release: Release }) {
  return (
    <Card className="h-full border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold">
              {release.tag}
            </CardTitle>
            <CardDescription>{release.repo}</CardDescription>
          </div>
          <Badge variant="outline">
            {new Date(release.published_at).toLocaleDateString()}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitBranch className="h-4 w-4 text-primary" />
          <span>{release.chain_name}</span>
          {release.fork_name && (
            <>
              <span className="text-muted-foreground/60">•</span>
              <span>{release.fork_name}</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {release.activation_ts && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Activation: {formatDateTime(release.activation_ts)}</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Published {formatDateTime(release.published_at)}
        </div>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="w-full justify-center"
        >
          <a href={release.url} target="_blank" rel="noreferrer">
            View release
          </a>
          <ExternalLink className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "TBD";
  }
  return new Date(value).toLocaleString();
}
