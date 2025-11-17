import { cn } from "@/lib/utils";

const TARGETS = Array.from({ length: 6 }).map((_, index) => ({
  id: index,
  delay: index * 0.8,
  size: 140 + index * 40,
}));

export function AlertsBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <div className="alerts-grid absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--color-primary)_18%,transparent),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent,rgba(0,0,0,0.8))]" />
    </div>
  );
}
