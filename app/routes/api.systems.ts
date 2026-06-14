import type { Route } from "./+types/api.systems";
import { loadDashboardData } from "~/lib/beszel.server";

export async function loader() {
  const data = await loadDashboardData();
  return Response.json(data);
}
