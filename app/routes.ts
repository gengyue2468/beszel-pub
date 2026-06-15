import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/systems/profiles", "routes/api.systems.profiles.ts"),
  route("api/systems", "routes/api.systems.ts"),
  route("api/systems/stream", "routes/api.systems.stream.ts"),
] satisfies RouteConfig;
