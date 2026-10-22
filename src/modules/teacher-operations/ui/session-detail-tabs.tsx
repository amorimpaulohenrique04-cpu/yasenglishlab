"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Tabs, type TabItem } from "@/components/ui";

export function SessionDetailTabs({ items }: { items: readonly TabItem[] }) {
  const search = useSearchParams(),
    pathname = usePathname();
  const requested = search.get("tab"),
    value = items.some((item) => item.id === requested) ? requested! : "overview";
  return (
    <Tabs
      ariaLabel="Detalhes da sessão"
      items={items}
      value={value}
      onValueChange={(tab) => {
        const query = new URLSearchParams(search.toString());
        query.set("tab", tab);
        window.history.replaceState(null, "", `${pathname}?${query}`);
      }}
    />
  );
}
