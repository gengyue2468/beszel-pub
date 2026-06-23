import dayjs from "dayjs";

export function formatHistoryTimeLabel(at?: string) {
  if (!at) return "—";

  const d = dayjs(at);
  if (!d.isValid()) return "—";

  const now = dayjs();
  if (now.diff(d, "second") < 45) return "now";

  if (d.isSame(now, "day")) return d.format("HH:mm");
  if (d.isSame(now.subtract(1, "day"), "day")) return `yesterday ${d.format("HH:mm")}`;
  if (d.isSame(now, "year")) return d.format("MM-DD HH:mm");
  return d.format("YYYY-MM-DD HH:mm");
}
