import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CalendarPlus,
  CalendarSync,
  Check,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDotDashed,
  CircleEllipsis,
  CircleX,
  GitBranch,
  Tag,
  X,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";

interface AnimateChangeInHeightProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimateChangeInHeight: React.FC<AnimateChangeInHeightProps> = ({
  children,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        const observedHeight = entries[0].contentRect.height;
        setHeight(observedHeight);
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  return (
    <motion.div
      className={cn(className, "overflow-hidden")}
      style={{ height }}
      animate={{ height }}
      transition={{ duration: 0.1, damping: 0.2, ease: "easeIn" }}
    >
      <div ref={containerRef}>{children}</div>
    </motion.div>
  );
};

export const FilterType = {
  CHAIN: "Chain",
  STATUS: "Status",
  EVENT_TYPE: "Event Type",
  CREATED_DATE: "Created date",
  PUBLISHED_DATE: "Published date",
  ACTIVATION_DATE: "Activation date",
} as const;

export type FilterType = (typeof FilterType)[keyof typeof FilterType];

export const FilterOperator = {
  IS: "is",
  IS_NOT: "is not",
  IS_ANY_OF: "is any of",
  INCLUDE: "include",
  DO_NOT_INCLUDE: "do not include",
  INCLUDE_ALL_OF: "include all of",
  INCLUDE_ANY_OF: "include any of",
  EXCLUDE_ALL_OF: "exclude all of",
  EXCLUDE_IF_ANY_OF: "exclude if any of",
  BEFORE: "before",
  AFTER: "after",
} as const;

export type FilterOperator = (typeof FilterOperator)[keyof typeof FilterOperator];

export const UpgradeStatus = {
  PROPOSED: "proposed",
  APPROVED: "approved",
  SCHEDULED: "scheduled",
  QUEUED: "queued",
  EXECUTED: "executed",
  CANCELED: "canceled",
  RELEASE_POSTED: "release_posted",
  ANNOUNCED: "announced",
} as const;

export type UpgradeStatus = (typeof UpgradeStatus)[keyof typeof UpgradeStatus];

export const DateFilter = {
  IN_THE_PAST: "in the past",
  IN_24_HOURS: "24 hours from now",
  IN_3_DAYS: "3 days from now",
  IN_1_WEEK: "1 week from now",
  IN_1_MONTH: "1 month from now",
  IN_3_MONTHS: "3 months from now",
} as const;

export type DateFilter = (typeof DateFilter)[keyof typeof DateFilter];

export type FilterOption = {
  name: string;
  icon: React.ReactNode | undefined;
  label?: string;
};

export type Filter = {
  id: string;
  type: FilterType;
  operator: FilterOperator;
  value: string[];
};

const FilterIcon = ({ type, value }: { type: FilterType; value?: string }) => {
  if (type === FilterType.CHAIN) {
    return <GitBranch className="size-3.5" />;
  }
  
  if (type === FilterType.STATUS && value) {
    switch (value) {
      case UpgradeStatus.PROPOSED:
        return <CircleDashed className="size-3.5 text-muted-foreground" />;
      case UpgradeStatus.APPROVED:
        return <Circle className="size-3.5 text-blue-400" />;
      case UpgradeStatus.SCHEDULED:
        return <CircleDotDashed className="size-3.5 text-yellow-400" />;
      case UpgradeStatus.QUEUED:
        return <CircleEllipsis className="size-3.5 text-orange-400" />;
      case UpgradeStatus.EXECUTED:
        return <CircleCheck className="size-3.5 text-green-400" />;
      case UpgradeStatus.CANCELED:
        return <CircleX className="size-3.5 text-red-400" />;
      case UpgradeStatus.RELEASE_POSTED:
        return <CircleAlert className="size-3.5 text-purple-400" />;
      case UpgradeStatus.ANNOUNCED:
        return <Circle className="size-3.5 text-cyan-400" />;
      default:
        return <CircleDashed className="size-3.5" />;
    }
  }
  
  if (type === FilterType.EVENT_TYPE) {
    return <Tag className="size-3.5" />;
  }
  
  if (type === FilterType.CREATED_DATE) {
    return <CalendarPlus className="size-3.5" />;
  }
  
  if (type === FilterType.PUBLISHED_DATE) {
    return <Calendar className="size-3.5" />;
  }
  
  if (type === FilterType.ACTIVATION_DATE) {
    return <CalendarSync className="size-3.5" />;
  }
  
  return <Circle className="size-3.5" />;
};

const filterOperators = ({
  filterType,
  filterValues,
}: {
  filterType: FilterType;
  filterValues: string[];
}) => {
  switch (filterType) {
    case FilterType.STATUS:
    case FilterType.CHAIN:
    case FilterType.EVENT_TYPE:
      if (Array.isArray(filterValues) && filterValues.length > 1) {
        return [FilterOperator.IS_ANY_OF, FilterOperator.EXCLUDE_IF_ANY_OF];
      } else {
        return [FilterOperator.IS, FilterOperator.IS_NOT];
      }
    case FilterType.CREATED_DATE:
    case FilterType.PUBLISHED_DATE:
    case FilterType.ACTIVATION_DATE:
      if (filterValues?.includes(DateFilter.IN_THE_PAST)) {
        return [FilterOperator.IS, FilterOperator.IS_NOT];
      } else {
        return [FilterOperator.BEFORE, FilterOperator.AFTER];
      }
    default:
      return [];
  }
};

const FilterOperatorDropdown = ({
  filterType,
  operator,
  filterValues,
  setOperator,
}: {
  filterType: FilterType;
  operator: FilterOperator;
  filterValues: string[];
  setOperator: (operator: FilterOperator) => void;
}) => {
  const operators = filterOperators({ filterType, filterValues });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="bg-muted hover:bg-muted/50 px-1.5 py-1 text-muted-foreground hover:text-primary transition shrink-0">
        {operator}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-fit min-w-fit">
        {operators.map((operator) => (
          <DropdownMenuItem
            key={operator}
            onClick={() => setOperator(operator)}
          >
            {operator}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const FilterValueCombobox = ({
  filterType,
  filterValues,
  setFilterValues,
  availableOptions,
}: {
  filterType: FilterType;
  filterValues: string[];
  setFilterValues: (filterValues: string[]) => void;
  availableOptions: FilterOption[];
}) => {
  const [open, setOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);
  const nonSelectedFilterValues = availableOptions?.filter(
    (filter) => !filterValues.includes(filter.name)
  );
  
  return (
    <Popover
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) {
          setTimeout(() => {
            setCommandInput("");
          }, 200);
        }
      }}
    >
      <PopoverTrigger
        className="rounded-none px-1.5 py-1 bg-muted hover:bg-muted/50 transition
  text-muted-foreground hover:text-primary shrink-0"
      >
        <div className="flex gap-1.5 items-center">
          <div className="flex items-center flex-row -space-x-1.5">
            <AnimatePresence mode="popLayout">
              {filterValues?.slice(0, 3).map((value) => (
                <motion.div
                  key={value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <FilterIcon type={filterType} value={value} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {filterValues?.length === 1
            ? filterValues?.[0]
            : `${filterValues?.length} selected`}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <AnimateChangeInHeight>
          <Command>
            <CommandInput
              placeholder={filterType}
              className="h-9"
              value={commandInput}
              onInputCapture={(e) => {
                setCommandInput(e.currentTarget.value);
              }}
              ref={commandInputRef}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {filterValues.map((value) => (
                  <CommandItem
                    key={value}
                    className="group flex gap-2 items-center"
                    onSelect={() => {
                      setFilterValues(filterValues.filter((v) => v !== value));
                      setTimeout(() => {
                        setCommandInput("");
                      }, 200);
                      setOpen(false);
                    }}
                  >
                    <Checkbox checked={true} />
                    <FilterIcon type={filterType} value={value} />
                    {value}
                  </CommandItem>
                ))}
              </CommandGroup>
              {nonSelectedFilterValues?.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    {nonSelectedFilterValues.map((filter: FilterOption) => (
                      <CommandItem
                        className="group flex gap-2 items-center"
                        key={filter.name}
                        value={filter.name}
                        onSelect={(currentValue: string) => {
                          setFilterValues([...filterValues, currentValue]);
                          setTimeout(() => {
                            setCommandInput("");
                          }, 200);
                          setOpen(false);
                        }}
                      >
                        <Checkbox
                          checked={false}
                          className="opacity-0 group-data-[selected=true]:opacity-100"
                        />
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
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </AnimateChangeInHeight>
      </PopoverContent>
    </Popover>
  );
};

const FilterValueDateCombobox = ({
  filterType,
  filterValues,
  setFilterValues,
  availableOptions,
}: {
  filterType: FilterType;
  filterValues: string[];
  setFilterValues: (filterValues: string[]) => void;
  availableOptions: FilterOption[];
}) => {
  const [open, setOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);
  
  return (
    <Popover
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) {
          setTimeout(() => {
            setCommandInput("");
          }, 200);
        }
      }}
    >
      <PopoverTrigger
        className="rounded-none px-1.5 py-1 bg-muted hover:bg-muted/50 transition
  text-muted-foreground hover:text-primary shrink-0"
      >
        {filterValues?.[0]}
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0">
        <AnimateChangeInHeight>
          <Command>
            <CommandInput
              placeholder={filterType}
              className="h-9"
              value={commandInput}
              onInputCapture={(e) => {
                setCommandInput(e.currentTarget.value);
              }}
              ref={commandInputRef}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {availableOptions.map((filter: FilterOption) => (
                  <CommandItem
                    className="group flex gap-2 items-center"
                    key={filter.name}
                    value={filter.name}
                    onSelect={(currentValue: string) => {
                      setFilterValues([currentValue]);
                      setTimeout(() => {
                        setCommandInput("");
                      }, 200);
                      setOpen(false);
                    }}
                  >
                    <span className="text-accent-foreground">
                      {filter.name}
                    </span>
                    <Check
                      className={cn(
                        "ml-auto",
                        filterValues.includes(filter.name)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </AnimateChangeInHeight>
      </PopoverContent>
    </Popover>
  );
};

export default function Filters({
  filters,
  setFilters,
  filterOptionsMap,
}: {
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
  filterOptionsMap: Record<FilterType, FilterOption[]>;
}) {
  return (
    <div className="flex gap-2">
      {filters
        .filter((filter) => filter.value?.length > 0)
        .map((filter) => (
          <div key={filter.id} className="flex gap-[1px] items-center text-xs">
            <div className="flex gap-1.5 shrink-0 rounded-l bg-muted px-1.5 py-1 items-center">
              <FilterIcon type={filter.type} />
              {filter.type}
            </div>
            <FilterOperatorDropdown
              filterType={filter.type}
              operator={filter.operator}
              filterValues={filter.value}
              setOperator={(operator) => {
                setFilters((prev) =>
                  prev.map((f) => (f.id === filter.id ? { ...f, operator } : f))
                );
              }}
            />
            {filter.type === FilterType.CREATED_DATE ||
            filter.type === FilterType.PUBLISHED_DATE ||
            filter.type === FilterType.ACTIVATION_DATE ? (
              <FilterValueDateCombobox
                filterType={filter.type}
                filterValues={filter.value}
                setFilterValues={(filterValues) => {
                  setFilters((prev) =>
                    prev.map((f) =>
                      f.id === filter.id ? { ...f, value: filterValues } : f
                    )
                  );
                }}
                availableOptions={filterOptionsMap[filter.type] || []}
              />
            ) : (
              <FilterValueCombobox
                filterType={filter.type}
                filterValues={filter.value}
                setFilterValues={(filterValues) => {
                  setFilters((prev) =>
                    prev.map((f) =>
                      f.id === filter.id ? { ...f, value: filterValues } : f
                    )
                  );
                }}
                availableOptions={filterOptionsMap[filter.type] || []}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setFilters((prev) => prev.filter((f) => f.id !== filter.id));
              }}
              className="bg-muted rounded-l-none rounded-r-sm h-6 w-6 text-muted-foreground hover:text-primary hover:bg-muted/50 transition shrink-0"
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
    </div>
  );
}

