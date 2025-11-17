import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ListFilter, Search, X } from "lucide-react";
import { nanoid } from "nanoid";
import * as React from "react";
import { AnimateChangeInHeight } from "@/components/ui/filters";
import Filters from "@/components/ui/filters";
import {
  DateFilter,
  FilterOperator,
  FilterType,
} from "@/components/ui/filters";
import type { Filter, FilterOption } from "@/components/ui/filters";

interface FilterConfig {
  filterViewOptions: FilterOption[][];
  filterOptionsMap: Record<FilterType, FilterOption[]>;
}

interface FilterToolbarProps {
  filters: Filter[];
  setFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
  config: FilterConfig;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
}

export function FilterToolbar({
  filters,
  setFilters,
  config,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
}: FilterToolbarProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedView, setSelectedView] = React.useState<FilterType | null>(
    null
  );
  const [commandInput, setCommandInput] = React.useState("");
  const commandInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 w-full">
      <div className="flex gap-2 items-center justify-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-9 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
        <Popover
          open={open}
          onOpenChange={(open) => {
            setOpen(open);
            if (!open) {
              setTimeout(() => {
                setSelectedView(null);
                setCommandInput("");
              }, 200);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              size="icon"
              className={cn(
                "h-9 w-9 shrink-0",
                filters.filter((f) => f.value?.length > 0).length > 0 &&
                  "text-primary"
              )}
            >
              <ListFilter className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <AnimateChangeInHeight>
              <Command>
                <CommandInput
                  placeholder={selectedView ? selectedView : "Filter..."}
                  className="h-9"
                  value={commandInput}
                  onInputCapture={(e) => {
                    setCommandInput(e.currentTarget.value);
                  }}
                  ref={commandInputRef}
                />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  {selectedView ? (
                    <CommandGroup>
                      {config.filterOptionsMap[selectedView]?.map(
                        (filter: FilterOption) => (
                          <CommandItem
                            className="group text-muted-foreground flex gap-2 items-center"
                            key={filter.name}
                            value={filter.name}
                            onSelect={(currentValue) => {
                              setFilters((prev) => [
                                ...prev,
                                {
                                  id: nanoid(),
                                  type: selectedView,
                                  operator:
                                    selectedView ===
                                      FilterType.ACTIVATION_DATE ||
                                    selectedView ===
                                      FilterType.PUBLISHED_DATE ||
                                    selectedView === FilterType.CREATED_DATE
                                      ? currentValue !== DateFilter.IN_THE_PAST
                                        ? FilterOperator.BEFORE
                                        : FilterOperator.IS
                                      : FilterOperator.IS,
                                  value: [currentValue],
                                },
                              ]);
                              setTimeout(() => {
                                setSelectedView(null);
                                setCommandInput("");
                              }, 200);
                              setOpen(false);
                            }}
                          >
                            {filter.icon}
                            <span className="text-accent-foreground">
                              {filter.name}
                            </span>
                            {filter.label && (
                              <span className="text-muted-foreground text-xs ml-auto">
                                {filter.label}
                              </span>
                            )}
                          </CommandItem>
                        )
                      )}
                    </CommandGroup>
                  ) : (
                    config.filterViewOptions.map(
                      (group: FilterOption[], index: number) => (
                        <React.Fragment key={index}>
                          <CommandGroup>
                            {group.map((filter: FilterOption) => (
                              <CommandItem
                                className="group text-muted-foreground flex gap-2 items-center"
                                key={filter.name}
                                value={filter.name}
                                onSelect={(currentValue) => {
                                  setSelectedView(currentValue as FilterType);
                                  setCommandInput("");
                                  commandInputRef.current?.focus();
                                }}
                              >
                                {filter.icon}
                                <span className="text-accent-foreground">
                                  {filter.name}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          {index < config.filterViewOptions.length - 1 && (
                            <CommandSeparator />
                          )}
                        </React.Fragment>
                      )
                    )
                  )}
                </CommandList>
              </Command>
            </AnimateChangeInHeight>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-2 flex-wrap items-center justify-center">
        <Filters
          filters={filters}
          setFilters={setFilters}
          filterOptionsMap={config.filterOptionsMap}
        />
        {filters.filter((filter) => filter.value?.length > 0).length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs rounded-sm"
            onClick={() => setFilters([])}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
