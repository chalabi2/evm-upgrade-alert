import { cn } from "@/lib/utils";

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
      <div className="absolute inset-0 dark:bg-[radial-gradient(circle_at_center,transparent,rgba(0,0,0,0.8))] bg-[radial-gradient(circle_at_center,transparent,rgba(255,255,255,0.8))]" />
    </div>
  );
}
