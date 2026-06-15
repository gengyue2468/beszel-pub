import type { Route } from "./+types/home";
import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import {
  SortSelect,
  SystemItem,
  SystemItemSkeleton,
  useViewMode,
  ViewModeTabs,
} from "~/components";
import { config, siteHeading } from "~/config";
import { emptyHomeLoader, type DashboardData } from "~/lib/dashboard";
import { loadSystemProfiles } from "~/lib/beszel.server";
import { useDashboardStream } from "~/lib/use-dashboard-stream";
import { sortSystems, type SortKey } from "~/lib/sort-systems";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: config.site.name },
    { name: "description", content: config.site.description },
  ];
}

export async function loader() {
  try {
    const profiles = await loadSystemProfiles();
    return { ...emptyHomeLoader(), profiles };
  } catch (error) {
    console.error("[beszel-pub] home loader profiles failed:", error);
    return emptyHomeLoader();
  }
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
}: {
  currentUrl: URL;
  nextUrl: URL;
}) {
  return currentUrl.pathname !== nextUrl.pathname;
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { profiles, ...initialDashboard } = loaderData;
  const [live, setLive] = useState<DashboardData>(initialDashboard);
  const { systems, error, fetchedAt } = live;
  const [received, setReceived] = useState(false);
  const isLoading = !received && !error;
  const connected = useDashboardStream(profiles, (data) => {
    setLive(data);
    setReceived(true);
  });
  const [now, setNow] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const viewModeFromUrl = useViewMode();
  const [viewMode, setViewMode] = useState(viewModeFromUrl);

  useEffect(() => {
    setViewMode(viewModeFromUrl);
  }, [viewModeFromUrl]);
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

  return (
    <div className="min-h-svh flex flex-col p-4 md:p-8">
      <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 mb-8">
        <Link to="/">
          <h1 className="font-bold">{siteHeading()}</h1>
        </Link>
        <h2 className="text-foreground-muted">
          {config.site.clockTagline}{" "}
          {now ? dayjs(now).format("h:mm:ss A") : "--:--:-- --"}
        </h2>
      </div>

      <section className="flex-1">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-bold">{config.dashboard.statusTitle}</h2>
          <div className="flex items-center gap-2">
            <ViewModeTabs value={viewMode} onValueChange={setViewMode} />
            <SortSelect value={sortBy} onValueChange={setSortBy} />
          </div>
        </div>

        {error && (
          <div className="border border-error/30 text-error bg-background-muted p-4 mb-4">
            {error}
          </div>
        )}

        {!isLoading && !error && systems.length === 0 && (
          <p className="text-foreground-muted">
            {config.dashboard.emptyServersMessage}
          </p>
        )}

        {isLoading ? (
          <div
            className={
              viewMode === "grid"
                ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border -mx-4"
                : "flex flex-col gap-px bg-border"
            }
          >
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className={
                  viewMode === "grid"
                    ? "min-w-0 px-4 py-3 bg-background"
                    : "min-w-0 py-2 bg-background"
                }
              >
                <SystemItemSkeleton variant={viewMode} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border -mx-4"
                : "flex flex-col gap-px bg-border"
            }
          >
            {sortedSystems.map((system) => (
              <div
                key={system.id}
                className={
                  viewMode === "grid"
                    ? "min-w-0 px-4 py-3 bg-background"
                    : "min-w-0 py-2 bg-background"
                }
              >
                <SystemItem
                  system={system}
                  now={displayNow}
                  variant={viewMode}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="text-center text-foreground-muted text-xs md:text-sm tabular-nums py-4">
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
        </a>
        .{" "}
        {!connected
          ? "Reconnecting…"
          : `Synced ${dayjs(fetchedAt).format("HH:mm:ss")}`}
      </footer>
    </div>
  );
}
