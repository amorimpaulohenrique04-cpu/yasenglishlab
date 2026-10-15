"use client";
import { useActionState, useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { cadenceLabels, type PlanCatalog, type PlanFormState } from "../domain/models";
import styles from "@/modules/admin-content/ui/admin-content.module.css";
export function EntitlementForm({
  planId,
  entitlement,
  latest,
  action,
}: {
  planId: string;
  entitlement: PlanCatalog["entitlements"][number];
  latest: PlanCatalog["versions"][number] | undefined;
  action: (state: PlanFormState, data: FormData) => Promise<PlanFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [limit, setLimit] = useState(String(latest?.limitValue ?? 0));
  const [cadence, setCadence] = useState(latest?.cadence ?? "NONE");
  const [date, setDate] = useState("");
  return (
    <form action={formAction} className={styles.editorForm}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="entitlementId" value={entitlement.id} />
      {state.error && (
        <Alert tone="error" title="Agendamento não concluído" description={state.error} />
      )}{" "}
      {state.success && (
        <Alert tone="success" title="Direito registrado" description={state.success} />
      )}
      <Input
        label="Limite"
        name="limitValue"
        type="number"
        min={0}
        max={entitlement.unit === "BOOLEAN" ? 1 : 99999999}
        step={1}
        required
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        disabled={pending}
      />
      <Select
        label="Recorrência"
        name="cadence"
        value={cadence}
        onChange={(e) => setCadence(e.target.value as typeof cadence)}
        options={Object.entries(cadenceLabels)
          .filter(([key]) => entitlement.unit !== "BOOLEAN" || key === "NONE")
          .map(([value, label]) => ({ value, label }))}
        disabled={pending}
      />
      <Input
        label="Vigência a partir de"
        name="effectiveFrom"
        type="datetime-local"
        required
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={pending}
        message="Horário de Recife (UTC−03:00). A data precisa ser futura e posterior às versões já agendadas."
      />
      <Button type="submit" loading={pending}>
        Agendar alteração
      </Button>
    </form>
  );
}
