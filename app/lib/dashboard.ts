import type { PublicSystem, SystemProfile } from "~/lib/beszel.server";

export type DashboardData = {
  systems: PublicSystem[];
  error: string | null;
  fetchedAt: string;
};

export type HomeLoaderData = DashboardData & {
  profiles: SystemProfile[];
};

export function emptyDashboard(): DashboardData {
  return {
    systems: [],
    error: null,
    fetchedAt: new Date().toISOString(),
  };
}

export function emptyHomeLoader(): HomeLoaderData {
  return {
    ...emptyDashboard(),
    profiles: [],
  };
}
