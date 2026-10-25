"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Tabs, type TabItem } from "@/components/ui";

export function SessionDetailTabs({ items }: { items: readonly TabItem[] }) {
  const search = useSearchParams(),
    pathname = usePathname();
  const requested = search.get("tab"),
    fromUrl = items.some((item) => item.id === requested) ? requested! : "overview";
  // Local state keeps the switch instant; the URL mirrors it so the tab survives reloads.
  const [value, setValue] = useState(fromUrl);
  const [synced, setSynced] = useState(fromUrl);
  if (fromUrl !== synced) {
    setSynced(fromUrl);
    setValue(fromUrl);
  }
  return (
    <Tabs
      ariaLabel="Detalhes da sessão"
      variant="underline"
      items={items}
      value={value}
      onValueChange={(tab) => {
        setValue(tab);
        const query = new URLSearchParams(search.toString());
        query.set("tab", tab);
        window.history.replaceState(null, "", `${pathname}?${query}`);
      }}
    />
  );
}
