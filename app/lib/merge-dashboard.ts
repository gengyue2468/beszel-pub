import type { DashboardData } from "~/lib/dashboard";
import type { PublicSystem, SystemProfile } from "~/lib/beszel.server";

export function mergeProfileWithLive(
  profile: SystemProfile | undefined,
  live: PublicSystem,
): PublicSystem {
  if (!profile) return live;

  return {
    ...live,
    name: profile.name || live.name,
    os: profile.os ?? live.os,
    spec: profile.spec ? { ...live.spec, ...profile.spec } : live.spec,
  };
}

export function mergeDashboardProfiles(
  data: DashboardData,
  profiles: SystemProfile[],
): DashboardData {
  if (profiles.length === 0) return data;

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  return {
    ...data,
    systems: data.systems.map((system) =>
      mergeProfileWithLive(profileMap.get(system.id), system),
    ),
  };
}
