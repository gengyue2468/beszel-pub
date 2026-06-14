import type { PublicSystem } from "~/lib/beszel.server";

export type SortKey = "name" | "cpu" | "ram" | "disk" | "uptime" | "status";

export const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "Name", value: "name" },
  { label: "CPU", value: "cpu" },
  { label: "RAM", value: "ram" },
  { label: "Disk", value: "disk" },
  { label: "Uptime", value: "uptime" },
  { label: "Status", value: "status" },
];

const STATUS_ORDER: Record<string, number> = {
  up: 0,
  paused: 1,
  pending: 2,
  down: 3,
};

export function sortSystems(systems: PublicSystem[], key: SortKey): PublicSystem[] {
  const sorted = [...systems];
  sorted.sort((a, b) => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name);
      case "cpu":
        return (b.info?.cpu ?? -1) - (a.info?.cpu ?? -1);
      case "ram":
        return (b.info?.mp ?? -1) - (a.info?.mp ?? -1);
      case "disk":
        return (b.info?.dp ?? -1) - (a.info?.dp ?? -1);
      case "uptime":
        return (b.info?.u ?? 0) - (a.info?.u ?? 0);
      case "status":
        return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      default:
        return 0;
    }
  });
  return sorted;
}
