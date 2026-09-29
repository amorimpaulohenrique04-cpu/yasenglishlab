import type { HTMLAttributes } from "react";

import { cx } from "@/components/ui/utils";

export function ContentContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx("yas-content-container", className)} />;
}
