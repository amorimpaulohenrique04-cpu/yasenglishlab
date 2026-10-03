import { Card } from "@/components/ui";
import { ResourceAccess } from "./resource-access";
type Resource = {
  id: string;
  resource_type: string;
  title: string;
  instructions: string;
  due_at: string | null;
  material_id: string | null;
  practice_activity_id: string | null;
  external_url: string | null;
};
export function SessionResources({
  resources,
  action,
}: {
  resources: Resource[];
  action: (id: string) => Promise<string>;
}) {
  return (
    <section aria-label="Recursos e tarefas">
      <h2>Recursos e tarefas</h2>
      {resources.length === 0 && <p>Nenhum recurso atribuído.</p>}
      {resources.map((item) => (
        <Card key={item.id}>
          <h3>{item.title}</h3>
          <p>{item.resource_type === "HOMEWORK" ? "Tarefa" : "Recurso"}</p>
          <p>{item.instructions}</p>
          {item.due_at && (
            <time dateTime={item.due_at}>
              Prazo: {new Date(item.due_at).toLocaleString("pt-BR", { timeZone: "America/Recife" })}
            </time>
          )}
          <ResourceAccess id={item.id} action={action} />
        </Card>
      ))}
    </section>
  );
}
