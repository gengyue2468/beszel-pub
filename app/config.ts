export const config = {
  site: {
    name: "st.gy.run",
    description: "",
    clockTagline: "Where the time is",
  },
  dashboard: {
    statusTitle: "Server Status",
    emptyServersMessage: "No monitored servers",
  },
} as const;

export function siteHeading() {
  return `[${config.site.name}]`;
}
