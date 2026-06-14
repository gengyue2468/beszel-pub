export const config = {
  site: {
    name: "st.gy.run",
    description: "",
    clockTagline: "Where the time is",
  },
  dashboard: {
    pollIntervalMs: 5_000,
    statusTitle: "Server Status",
    emptyServersMessage: "No monitored servers",
  },
} as const;

export function siteHeading() {
  return `[${config.site.name}]`;
}
