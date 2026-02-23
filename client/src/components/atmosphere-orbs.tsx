import { cn } from "@/lib/utils";

type AtmosphereOrbsProps = {
  className?: string;
};

export function AtmosphereOrbs({ className }: AtmosphereOrbsProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="hero-orb hero-orb--a" />
      <div className="hero-orb hero-orb--b" />
    </div>
  );
}

