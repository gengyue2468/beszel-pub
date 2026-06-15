import { loadSystemProfiles } from "~/lib/beszel.server";

export async function loader() {
  try {
    const profiles = await loadSystemProfiles();
    return Response.json({
      profiles,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[beszel-pub] profiles loader failed:", error);
    return Response.json(
      { profiles: [], error: "Failed to load system profiles" },
      { status: 500 },
    );
  }
}
