import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export interface RadarBlip {
  id: string;
  angle: number; // radians
  radius: number; // percentage offset from center
  intensity: number; // 0-1 controlling glow
  label: string;
}

interface RadarBackgroundProps {
  blips: RadarBlip[];
  className?: string;
  focusedUpgrade?: string | null;
}

const CONCENTRIC_STOPS = [10, 25, 40, 55, 70];
const RADIAL_LINES = [0, 45, 90, 135];

export function RadarBackground({
  blips,
  className,
  focusedUpgrade,
}: RadarBackgroundProps) {
  console.log(focusedUpgrade);
  console.log(blips);
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      <div className="relative h-full w-full">
        <div className="absolute inset-0 z-0">
          <div className="radar-overlay-grid absolute inset-0" />
          <div className="radar-overlay-radial absolute inset-0" />
          <div className="radar-overlay-vignette absolute inset-0" />
        </div>
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <div
            className="radar-wrapper relative z-10 aspect-square w-full max-w-none"
            style={{
              width: "min(140vh, 140vw)",
            }}
          >
            <div className="radar-base absolute inset-0 rounded-full border border-primary/50" />

            {CONCENTRIC_STOPS.map((stop) => (
              <div
                key={`circle-${stop}`}
                className="absolute rounded-full border border-primary/40"
                style={{
                  inset: `${stop}%`,
                }}
              />
            ))}

            {RADIAL_LINES.map((deg) => (
              <div
                key={`radial-${deg}`}
                className="absolute bg-linear-to-b from-transparent via-primary/60 to-transparent"
                style={{
                  width: "1px",
                  height: "100%",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) rotate(${deg}deg)`,
                  transformOrigin: "center",
                }}
              />
            ))}

            <div className="radar-beam absolute inset-0 rounded-full" />
            <div className="radar-glow absolute inset-[10%] rounded-full" />

            {blips.map((blip) => {
              const radialX = Math.cos(blip.angle) * blip.radius;
              const radialY = Math.sin(blip.angle) * blip.radius;

              const left = 50 + radialX;
              const top = 50 + radialY;

              const isFocused = focusedUpgrade === blip.label;

              return (
                <motion.div
                  key={blip.id}
                  className="radar-blip absolute z-40 flex flex-col items-center text-center text-xs font-medium text-primary bg-transparent rounded-full"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: "translate(-50%, -50%)",
                    opacity: 1,
                  }}
                >
                  <span className="radar-blip-dot relative mb-1 flex h-7 w-7 items-center justify-center bg-transparent rounded-full">
                    <span className="h-6 w-6 rounded-full bg-primary" />
                    {isFocused && (
                      <motion.span
                        className="absolute inline-block h-3 w-3 rounded-full border border-primary bg-primary"
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 8, opacity: 1 }}
                        exit={{ scale: 1.5, opacity: 0 }}
                      />
                    )}
                  </span>
                  <span className="radar-blip-label text-2xl font-bold rounded-full bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary backdrop-blur">
                    {blip.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
