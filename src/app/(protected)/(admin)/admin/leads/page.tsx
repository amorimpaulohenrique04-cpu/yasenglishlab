import {
  Alert,
  Badge,
  Button,
  Card,
  DetailDrawer,
  EmptyState,
  FilterBar,
  FormDialog,
  Input,
  KanbanBoard,
  PageHeader,
  Select,
} from "@/components/ui";
import { loadAdminLeads } from "@/server/crm/crm";
import { nextCrmStages } from "@/modules/crm";
import { crmAction } from "./actions";

const stages = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;
const stageLabels: Record<(typeof stages)[number], string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  QUALIFIED: "Qualificado",
  WON: "Convertido",
  LOST: "Perdido",
};
const temperatureLabels = { COLD: "Frio", WARM: "Morno", HOT: "Quente" } as const;

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; page?: string; result?: string }>;
}) {
  const params = await searchParams;
  const stage = stages.includes(params.stage as (typeof stages)[number]) ? params.stage! : null;
  const pageNumber = Math.max(1, Math.min(400, Number(params.page) || 1));
  const query = (params.q ?? "").slice(0, 120);
  const boardStages = stage ? [stage] : [...stages];
  const results = await Promise.all(
    boardStages.map((currentStage) => loadAdminLeads(query, currentStage, pageNumber)),
  );
  const leads = results.flatMap((result) => result.leads);
  return (
    <div className="yas-stack">
      <PageHeader
        title="Leads"
        description="Acompanhe contatos e próximos passos comerciais locais."
      />
      {params.result === "saved" && (
        <Alert tone="success" title="Alteração registrada" description="O CRM foi atualizado." />
      )}
      {params.result === "invalid" && (
        <Alert
          tone="error"
          title="Dados inválidos"
          description="Confira os campos e o contato informado."
        />
      )}
      {params.result === "error" && (
        <Alert
          tone="error"
          title="Operação não concluída"
          description="Confira as regras do lead e tente novamente."
        />
      )}
      <section className="yas-stack" aria-label="Criar lead">
        <FormDialog trigger="Novo lead" title="Criar lead">
          <form action={crmAction} className="yas-grid">
            <input type="hidden" name="operation" value="CREATE" />
            <Input name="name" label="Nome" maxLength={160} required />
            <Input name="email" label="Email" type="email" maxLength={254} />
            <Input name="phone" label="Telefone" type="tel" maxLength={32} />
            <Input name="source" label="Origem" maxLength={80} required />
            <Select
              name="temperature"
              label="Temperatura"
              options={Object.entries(temperatureLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Input
              name="estimated_value"
              label="Valor estimado opcional"
              type="number"
              min="0"
              step="0.01"
            />
            <Button type="submit">Criar lead</Button>
          </form>
        </FormDialog>
      </section>
      <FilterBar action="/admin/leads" role="search" aria-label="Filtrar leads">
        <Input
          name="q"
          label="Buscar nome, email ou telefone"
          defaultValue={query}
          maxLength={120}
        />
        <Select
          name="stage"
          label="Etapa"
          defaultValue={stage ?? ""}
          options={[
            { value: "", label: "Todas" },
            ...stages.map((value) => ({ value, label: stageLabels[value] })),
          ]}
        />
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </FilterBar>
      {leads.length === 0 ? (
        <EmptyState
          title="Nenhum lead nesta página"
          description="Ajuste a busca ou crie um lead."
        />
      ) : (
        <KanbanBoard
          label="Leads por etapa"
          columns={stages.map((boardStage) => {
            const stageLeads = leads.filter((lead) => lead.stage === boardStage);
            return {
              id: `leads-${boardStage.toLowerCase()}`,
              title: stageLabels[boardStage],
              count: stageLeads.length,
              children: stageLeads.length ? (
                stageLeads.map((lead) => (
                  <Card key={lead.id} className="yas-stack">
                    <div className="yas-inline">
                      <h2>{lead.name}</h2>
                      <Badge tone={lead.overdue ? "warning" : "neutral"}>
                        {stageLabels[lead.stage]}
                      </Badge>
                      <Badge tone="info">{temperatureLabels[lead.temperature]}</Badge>
                    </div>
                    <p>
                      {lead.email ?? lead.phone} · Origem: {lead.source} · Responsável:{" "}
                      {lead.owner_name ?? "Sem responsável"}
                    </p>
                    {lead.linked_user_id && <p>Vinculado a Student existente</p>}
                    {lead.next_task && (
                      <p>
                        {lead.overdue ? "Atrasada: " : "Próxima tarefa: "}
                        {lead.next_task.title}
                        {lead.next_task.due_at
                          ? ` · ${new Date(lead.next_task.due_at).toLocaleString("pt-BR", { timeZone: "America/Recife" })}`
                          : ""}
                      </p>
                    )}
                    <DetailDrawer
                      trigger="Detalhes e ações"
                      title={lead.name}
                      description="Detalhes e ações do lead"
                    >
                      <form action={crmAction} className="yas-stack">
                        <input type="hidden" name="operation" value="UPDATE" />
                        <input type="hidden" name="leadId" value={lead.id} />
                        <Input
                          name="name"
                          label="Nome"
                          defaultValue={lead.name}
                          maxLength={160}
                          required
                        />
                        <Input
                          name="email"
                          label="Email"
                          type="email"
                          defaultValue={lead.email ?? ""}
                          maxLength={254}
                        />
                        <Input
                          name="phone"
                          label="Telefone"
                          type="tel"
                          defaultValue={lead.phone ?? ""}
                          maxLength={32}
                        />
                        <Input
                          name="source"
                          label="Origem"
                          defaultValue={lead.source}
                          maxLength={80}
                          required
                        />
                        <Select
                          name="temperature"
                          label="Temperatura"
                          defaultValue={lead.temperature}
                          options={Object.entries(temperatureLabels).map(([value, label]) => ({
                            value,
                            label,
                          }))}
                        />
                        <Input
                          name="estimated_value"
                          label="Valor estimado opcional"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={lead.estimated_value ?? ""}
                        />
                        <Input
                          name="owner_user_id"
                          label="ID do responsável Admin/Support (vazio remove)"
                          defaultValue={lead.owner_user_id ?? ""}
                        />
                        <Button type="submit" variant="secondary">
                          Salvar dados
                        </Button>
                      </form>
                      <form action={crmAction} className="yas-inline">
                        <input type="hidden" name="operation" value="STAGE" />
                        <input type="hidden" name="leadId" value={lead.id} />
                        <Select
                          name="stage"
                          label="Avançar etapa"
                          options={nextCrmStages(lead.stage).map((value) => ({
                            value,
                            label: stageLabels[value],
                          }))}
                          required
                        />
                        <Button type="submit" variant="secondary">
                          Atualizar etapa
                        </Button>
                      </form>
                      {!lead.linked_user_id && (
                        <form action={crmAction} className="yas-inline">
                          <input type="hidden" name="operation" value="LINK_USER" />
                          <input type="hidden" name="leadId" value={lead.id} />
                          <Input name="user_id" label="ID de Student existente" required />
                          <Button type="submit" variant="secondary">
                            Vincular identidade
                          </Button>
                        </form>
                      )}
                      <form action={crmAction} className="yas-stack">
                        <input type="hidden" name="operation" value="INTERACTION" />
                        <input type="hidden" name="leadId" value={lead.id} />
                        <Select
                          name="type"
                          label="Tipo de interação"
                          options={["NOTE", "CALL", "MEETING", "EMAIL"].map((value) => ({
                            value,
                            label: value,
                          }))}
                        />
                        <Input name="summary" label="Resumo" maxLength={4000} required />
                        <Button type="submit" variant="secondary">
                          Registrar interação
                        </Button>
                      </form>
                      <form action={crmAction} className="yas-stack">
                        <input type="hidden" name="operation" value="TASK" />
                        <input type="hidden" name="leadId" value={lead.id} />
                        <Input name="title" label="Nova tarefa" maxLength={240} required />
                        <Input
                          name="due_at"
                          label="Prazo com fuso"
                          placeholder="2026-10-04T14:30:00-03:00"
                        />
                        <Input name="owner_user_id" label="ID do responsável Admin/Support" />
                        <Button type="submit" variant="secondary">
                          Criar tarefa
                        </Button>
                      </form>
                      {lead.tasks.map((task) => (
                        <div key={task.id}>
                          <span>
                            {task.status === "OPEN" ? "Aberta" : "Concluída"}: {task.title}
                          </span>
                          {task.status === "OPEN" && (
                            <form action={crmAction}>
                              <input type="hidden" name="operation" value="COMPLETE_TASK" />
                              <input type="hidden" name="taskId" value={task.id} />
                              <Button type="submit" variant="outline">
                                Concluir tarefa
                              </Button>
                            </form>
                          )}
                        </div>
                      ))}
                      {lead.interactions.map((item) => (
                        <p key={item.id}>
                          {item.type} · {item.summary}
                        </p>
                      ))}
                    </DetailDrawer>
                  </Card>
                ))
              ) : (
                <p>Nenhum lead nesta etapa.</p>
              ),
            };
          })}
        />
      )}
      {leads.length >= boardStages.length * 25 && (
        <p>
          Algumas colunas atingiram o limite de 25 registros; refine a busca para localizar outros
          leads.
        </p>
      )}
    </div>
  );
}
