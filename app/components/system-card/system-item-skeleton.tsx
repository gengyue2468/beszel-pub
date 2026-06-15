import type { ViewMode } from "~/components/view-mode-toggle";

export function SystemItemSkeleton({ variant }: { variant: ViewMode }) {
  const bone = "animate-pulse bg-background-muted";

  if (variant === "list") {
    return (
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <div className={`h-14 w-full shrink-0 md:w-56 lg:w-64 ${bone}`} />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div className={`h-10 ${bone}`} />
              <div className={`h-2.5 w-14 ${bone}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <div className={`h-48 w-full ${bone}`} />;
}
