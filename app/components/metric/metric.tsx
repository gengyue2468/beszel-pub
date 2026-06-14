export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-foreground-muted text-xs">{label}</div>
      <div className="text-sm tabular-nums">{value}</div>
    </div>
  );
}
