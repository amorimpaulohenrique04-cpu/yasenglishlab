import { Alert, Button, Card, PageHeader } from "@/components/ui";
import { AvailabilitySlotForm } from "./availability-slot-form";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { saveAvailabilityAction } from "./actions";
export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ save?: string }>;
}) {
  const context = await loadTeacherOperationContext();
  return (
    <div className={styles.page}>
      <PageHeader
        title="Disponibilidade"
        description="Defina os horários disponíveis para seus encontros."
      />
      {(await searchParams).save === "error" && (
        <Alert
          tone="error"
          title="Intervalo rejeitado"
          description="Confira sobreposição, datas futuras e encontros que dependem deste intervalo."
        />
      )}
      <Card>
        <AvailabilitySlotForm operation="CREATE" />
      </Card>
      {context.availability.map((item) => (
        <Card key={item.id}>
          <AvailabilitySlotForm
            id={item.id}
            operation="EDIT"
            startsAt={item.starts_at}
            endsAt={item.ends_at}
          />
          <form action={saveAvailabilityAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="operation" value="DELETE" />
            <Button type="submit" variant="secondary">
              Remover intervalo
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
