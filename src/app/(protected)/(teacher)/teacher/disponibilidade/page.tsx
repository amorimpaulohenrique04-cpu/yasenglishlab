import { Alert, Button, Card, Input, PageHeader } from "@/components/ui";
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
        description="Defina intervalos explícitos para seus encontros. Informe o fuso no formato ISO 8601; horários são exibidos em America/Recife."
      />
      {(await searchParams).save === "error" && (
        <Alert
          tone="error"
          title="Intervalo rejeitado"
          description="Confira sobreposição, datas futuras e encontros que dependem deste intervalo."
        />
      )}
      <Card>
        <form action={saveAvailabilityAction} className={styles.operationForm}>
          <input type="hidden" name="operation" value="CREATE" />
          <Input
            label="Início com fuso"
            name="starts_at"
            required
            placeholder="2026-10-10T09:00:00-03:00"
          />
          <Input
            label="Término com fuso"
            name="ends_at"
            required
            placeholder="2026-10-10T18:00:00-03:00"
          />
          <Button type="submit">Adicionar intervalo</Button>
        </form>
      </Card>
      {context.availability.map((item) => (
        <Card key={item.id}>
          <form action={saveAvailabilityAction} className={styles.operationForm}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="operation" value="EDIT" />
            <Input
              label="Início com fuso"
              name="starts_at"
              defaultValue={item.starts_at}
              required
            />
            <Input label="Término com fuso" name="ends_at" defaultValue={item.ends_at} required />
            <Button type="submit" variant="outline">
              Salvar intervalo
            </Button>
          </form>
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
