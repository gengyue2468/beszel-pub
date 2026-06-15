import { Tabs } from "@base-ui/react/tabs";
import { startTransition } from "react";
import { useSearchParams } from "react-router";

export type ViewMode = "grid" | "list";

export function parseViewMode(value: string | null): ViewMode {
  return value === "list" ? "list" : "grid";
}

export function useViewMode(): ViewMode {
  const [searchParams] = useSearchParams();
  return parseViewMode(searchParams.get("view"));
}

const tab =
  "inline-flex items-center justify-center px-1.5 py-1 text-foreground-muted outline-none hover:text-foreground data-active:text-foreground data-active:bg-background-muted";

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M1 1h6v6H1V1zm0 8h6v6H1V9zm8-8h6v6H9V1zm0 8h6v6H9V9z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M1 2h14v2H1V2zm0 6h14v2H1V8zm0 6h14v2H1v-2z" />
    </svg>
  );
}

export function ViewModeTabs({
  value,
  onValueChange,
}: {
  value: ViewMode;
  onValueChange: (value: ViewMode) => void;
}) {
  const [, setSearchParams] = useSearchParams();

  return (
    <Tabs.Root
      value={value}
      onValueChange={(next) => {
        if (next === null || next === value) return;
        const mode = next as ViewMode;
        onValueChange(mode);
        startTransition(() => {
          setSearchParams(
            (prev) => {
              const params = new URLSearchParams(prev);
              if (mode === "grid") params.delete("view");
              else params.set("view", mode);
              return params;
            },
            { replace: true, preventScrollReset: true },
          );
        });
      }}
    >
      <Tabs.List className="inline-flex border border-border bg-background-subtle">
        <Tabs.Tab className={tab} value="grid" aria-label="Grid view">
          <GridIcon />
        </Tabs.Tab>
        <Tabs.Tab className={tab} value="list" aria-label="List view">
          <ListIcon />
        </Tabs.Tab>
      </Tabs.List>
    </Tabs.Root>
  );
}
