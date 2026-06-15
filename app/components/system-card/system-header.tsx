import type { PublicSystem } from "~/lib/beszel.server";
import { formatLastSeen, formatLoad, statusColor } from "./format";

const muted = "text-foreground-muted text-xs md:text-sm";

export function SystemHeader({
  system,
  now,
  compact = false,
  className,
}: {
  system: PublicSystem;
  now: Date;
  compact?: boolean;
  className?: string;
}) {
  const info = system.info;
  const load = formatLoad(info);
  const meta = [system.os, system.spec?.kernel, system.spec?.arch]
    .filter(Boolean)
    .join(" · ");
  const lastSeen =
    system.status !== "up" ? formatLastSeen(system.updated, now) : null;

  if (compact) {
    return (
      <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
        <span className="font-bold leading-tight">
          {system.name}{" "}
          <span className={`uppercase ${statusColor(system.status)}`}>
            [{system.status}]
          </span>
        </span>

        {load && <span className={`${muted} tabular-nums`}>[{load}]</span>}
        {meta && <div className={`${muted} leading-snug line-clamp-2`}>{meta}</div>}
        {lastSeen && (
          <div className={`${muted} tabular-nums`}>last seen {lastSeen}</div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-bold truncate">{system.name}</span>
          {load && (
            <span className={`${muted} tabular-nums shrink-0`}>[{load}]</span>
          )}
        </div>
        <span className={`uppercase shrink-0 ${statusColor(system.status)}`}>
          {system.status}
        </span>
      </div>

      {meta && <div className={muted}>{meta}</div>}

      {lastSeen && (
        <div className={`${muted} tabular-nums`}>last seen {lastSeen}</div>
      )}
    </div>
  );
}
