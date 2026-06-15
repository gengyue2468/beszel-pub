export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-foreground-muted text-xs md:text-sm">{label}</div>
      <div className="tabular-nums">{value}</div>
    </div>
  );
}
