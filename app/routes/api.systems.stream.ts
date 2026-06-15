import type { Route } from "./+types/api.systems.stream";
import { subscribeDashboardStream } from "~/lib/dashboard-stream.server";

export function loader({ request }: Route.LoaderArgs) {
  return subscribeDashboardStream(request);
}
