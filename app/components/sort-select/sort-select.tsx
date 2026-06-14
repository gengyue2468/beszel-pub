import type { ComponentProps } from "react";
import { Select } from "@base-ui/react/select";
import { SORT_OPTIONS, type SortKey } from "~/lib/sort-systems";

function ChevronIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}

function CheckIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      {...props}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

export function SortSelect({
  value,
  onValueChange,
}: {
  value: SortKey;
  onValueChange: (value: SortKey) => void;
}) {
  return (
    <Select.Root
      items={SORT_OPTIONS}
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as SortKey);
      }}
      modal={false}
    >
      <Select.Trigger className="inline-flex items-center gap-1 border border-border bg-background-subtle px-1.5 py-1 text-xs text-foreground-muted outline-none data-popup-open:text-foreground">
        <span>Sort by</span>
        <Select.Value />
        <Select.Icon className="text-foreground-muted">
          <ChevronIcon />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} align="end">
          <Select.Popup className="min-w-32 rounded border border-border bg-background-subtle py-0.5 shadow-sm outline-none">
            <Select.List className="outline-none">
              {SORT_OPTIONS.map(({ label, value: optionValue }) => (
                <Select.Item
                  key={optionValue}
                  value={optionValue}
                  className="flex w-full cursor-default items-center justify-between gap-2 px-1.5 py-1 text-xs outline-none data-highlighted:bg-background-muted data-selected:text-foreground"
                >
                  <Select.ItemText>{label}</Select.ItemText>
                  <Select.ItemIndicator className="w-3 shrink-0 text-success">
                    <CheckIcon />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
