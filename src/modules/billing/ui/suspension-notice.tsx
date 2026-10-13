import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import type { SubscriptionAccessState } from "@/modules/billing/domain/access";
import { suspensionCopy, type SuspensionContext } from "./suspension-copy";

// Single notice for a billing-suspended student. Renders nothing when access is ok, so pages can pass the
// loader result straight through.
export function SubscriptionSuspendedNotice({
  access,
  context = "content",
  headingLevel = 2,
}: {
  access: SubscriptionAccessState;
  context?: SuspensionContext;
  headingLevel?: 2 | 3;
}) {
  if (access.kind !== "suspended") return null;
  const copy = suspensionCopy(access, context);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Card
      variant="accent"
      className="yas-stack"
      role="status"
      aria-label="Estado da assinatura"
      data-suspension={access.reason}
    >
      <div>
        <Badge tone="warning">{copy.badge}</Badge>
      </div>
      <Heading>{copy.title}</Heading>
      <p>{copy.description}</p>
      <p>{copy.guidance}</p>
      {copy.action && (
        <div>
          <Link className="yas-button yas-button--primary yas-focusable" href={copy.action.href}>
            {copy.action.label}
          </Link>
        </div>
      )}
    </Card>
  );
}
