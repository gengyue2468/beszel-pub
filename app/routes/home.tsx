import type { Route } from "./+types/home";
import { useState, useEffect, useMemo } from "react";
import { useFetcher } from "react-router";
import dayjs from "dayjs";
import { SortSelect, SystemCard } from "~/components";
import { config, siteHeading } from "~/config";
import { loadDashboardData } from "~/lib/beszel.server";
import { sortSystems, type SortKey } from "~/lib/sort-systems";

export function meta({}: Route.MetaArgs) {
  return [
    { title: config.site.name },
    { name: "description", content: config.site.description },
  ];
}

export async function loader() {
  return loadDashboardData();
}

export default function App({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof loader>();
  const live = fetcher.data ?? loaderData;
  const { systems, error, fetchedAt } = live;
  const [now, setNow] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const isRefreshing = fetcher.state !== "idle";
  const sortedSystems = useMemo(
    () => sortSystems(systems, sortBy),
    [systems, sortBy],
  );
  const displayNow = now ?? new Date(fetchedAt);

  useEffect(() => {
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const poll = () => fetcher.load("/api/systems");
    const interval = setInterval(poll, config.dashboard.pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetcher]);

  return (
    <div className="min-h-svh flex flex-col p-4 md:p-8 text-sm md:text-base">
      <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 mb-8">
        <h1 className="font-bold">{siteHeading()}</h1>
        <h2 className="text-foreground-muted">
          {config.site.clockTagline}{" "}
          {now ? dayjs(now).format("h:mm:ss A") : "--:--:-- --"}
        </h2>
      </div>

      <section className="flex-1">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-bold">{config.dashboard.statusTitle}</h2>
          <SortSelect value={sortBy} onValueChange={setSortBy} />
        </div>

        {error && (
          <div className="border border-error/30 text-error bg-background-muted p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {!error && systems.length === 0 && (
          <p className="text-foreground-muted">
            {config.dashboard.emptyServersMessage}
          </p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border -mx-4">
          {sortedSystems.map((system) => (
            <div key={system.id} className="min-w-0 px-4 py-3 bg-background">
              <SystemCard system={system} now={displayNow} />
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center text-foreground-muted text-xs tabular-nums py-4">
        Powered by{" "}
        <a
          href="https://beszel.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Beszel
        </a>{" "}
        &{" "}
        <a
          href="https://github.com/gengyue2468/beszel-pub"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Beszel Pub
        </a>.{" "}
        {isRefreshing
          ? "Syncing…"
          : `Synced ${dayjs(fetchedAt).format("HH:mm:ss")}`}
      </footer>
    </div>
  );
}
