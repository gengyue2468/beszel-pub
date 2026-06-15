import type { PublicSystem } from "~/lib/beszel.server";
import { SystemItem } from "./system-item";

export function SystemCard({
  system,
  now,
}: {
  system: PublicSystem;
  now: Date;
}) {
  return <SystemItem system={system} now={now} variant="grid" />;
}
