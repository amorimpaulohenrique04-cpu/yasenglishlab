import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { MotionProvider } from "@/components/motion";

import {
  Alert,
  Avatar,
  Breadcrumbs,
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  Drawer,
  Dropdown,
  EmptyState,
  ErrorState,
  FilterBar,
  FormDialog,
  IconButton,
  Input,
  MetricCard,
  PageHeader,
  ProgressBar,
  ProgressRing,
  Radio,
  SectionHeader,
  SegmentedNav,
  Select,
  SelectableTag,
  Skeleton,
  Stepper,
  Tabs,
  Tag,
  Textarea,
  Toast,
  Tooltip,
} from ".";

const meta = {
  title: "Design System/Foundations",
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConfirmationDialog: Story = {
  render: function ConfirmationDialogStory() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Mostrar confirmação</Button>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          presentation="confirmation"
          tone="success"
          icon="check-c"
          title="Revisão finalizada com sucesso!"
          description="A recomendação foi registrada e está disponível para o aluno."
          actions={
            <>
              <Button variant="soft" onClick={() => setOpen(false)}>
                Voltar para a lista
              </Button>
              <Button onClick={() => setOpen(false)} trailingIcon={<ArrowIcon />}>
                Próxima revisão
              </Button>
            </>
          }
        >
          {null}
        </Dialog>
      </>
    );
  },
};

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export const CoreStates: Story = {
  render: () => (
    <div className="yas-stack" style={{ maxWidth: 920 }}>
      <PageHeader
        title="Design System Yas"
        description="Estados recorrentes derivados das referências aprovadas."
        actions={<Button variant="primary">Ação prioritária</Button>}
      />

      <Card>
        <SectionHeader
          title="Buttons"
          description="Amarelo é reservado para ação prioritária; roxo sustenta identidade e navegação."
        />
        <div className="yas-cluster" style={{ marginTop: 20 }}>
          <Button variant="primary" trailingIcon={<ArrowIcon />}>
            Continuar
          </Button>
          <Button variant="secondary">Salvar</Button>
          <Button variant="outline">Ver detalhes</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="danger">Excluir</Button>
          <Button loading>Carregando</Button>
          <Button disabled>Indisponível</Button>
          <Tooltip content="Mais opções">
            <IconButton label="Mais opções">•••</IconButton>
          </Tooltip>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Status e seleção" />
        <div className="yas-cluster" style={{ marginTop: 20 }}>
          <Badge>Nível A2</Badge>
          <Badge tone="success">Concluído ✓</Badge>
          <Badge tone="warning">Atenção !</Badge>
          <Badge tone="error">Erro !</Badge>
          <Tag>Vocabulário</Tag>
          <Tag selected>Selecionado ✓</Tag>
          <SelectableTag selected>Interativo</SelectableTag>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Progresso" />
        <div className="yas-stack" style={{ marginTop: 20 }}>
          <ProgressBar value={62} label="Minha evolução" />
          <ProgressBar value={42} label="Ação prioritária" tone="priority" />
          <div className="yas-cluster">
            <ProgressRing value={68}>A2</ProgressRing>
            <Avatar fallback="YA" label="Yasmin" size="lg" />
          </div>
        </div>
      </Card>

      <Alert
        tone="success"
        title="Alterações salvas"
        description="Suas preferências foram atualizadas com sucesso."
      />
      <Toast
        tone="info"
        title="Novo material disponível"
        description="O resumo da aula já pode ser revisado."
      />
    </div>
  ),
};

export const FormControls: Story = {
  render: () => (
    <div className="yas-stack" style={{ maxWidth: 720 }}>
      <PageHeader
        title="Campos e validação"
        description="Labels reais, mensagens sem depender apenas de cor e controles com foco visível."
      />
      <Input label="Nome completo" placeholder="Seu nome" />
      <Input
        label="E-mail"
        defaultValue="email-invalido"
        tone="error"
        message="Informe um e-mail válido."
      />
      <Input label="Código" defaultValue="YAS-2026" tone="success" message="Código verificado ✓" />
      <Input label="Campo desabilitado" defaultValue="Não editável" disabled />
      <Select
        label="Objetivo"
        defaultValue="conversation"
        options={[
          { value: "conversation", label: "Conversação no dia a dia" },
          { value: "travel", label: "Viagens" },
          { value: "work", label: "Inglês profissional" },
        ]}
      />
      <Textarea
        label="Sobre sua meta"
        defaultValue="Quero me sentir mais confiante para conversar em situações reais, sem depender de frases decoradas."
      />
      <div className="yas-cluster">
        <Checkbox label="Quero receber lembretes" defaultChecked />
        <Radio label="Manhã" name="period" defaultChecked />
        <Radio label="Noite" name="period" />
      </div>
    </div>
  ),
};

export const NavigationAndOverlays: Story = {
  render: function NavigationAndOverlaysStory() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    return (
      <div className="yas-stack" style={{ maxWidth: 760 }}>
        <Tabs
          ariaLabel="Área de progresso"
          defaultValue="overview"
          items={[
            {
              id: "overview",
              label: "Visão geral",
              content: <Card variant="soft">Conteúdo da visão geral.</Card>,
            },
            {
              id: "skills",
              label: "Habilidades",
              content: <Card variant="soft">Conteúdo das habilidades.</Card>,
            },
            {
              id: "history",
              label: "Histórico",
              content: <Card variant="soft">Conteúdo do histórico.</Card>,
            },
            { id: "locked", label: "Bloqueado", content: null, disabled: true },
          ]}
        />
        <div className="yas-cluster">
          <Dropdown
            label="Mais ações"
            items={[
              { id: "edit", label: "Editar" },
              { id: "duplicate", label: "Duplicar" },
              { id: "delete", label: "Excluir", destructive: true },
            ]}
          />
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Abrir diálogo
          </Button>
          <Button variant="outline" onClick={() => setDrawerOpen(true)}>
            Abrir drawer
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Confirmar ação"
          description="Este exemplo usa o elemento dialog nativo e preserva Escape/foco modal do navegador."
          actions={
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              Confirmar
            </Button>
          }
        >
          <p>Conteúdo modal curto e objetivo.</p>
        </Dialog>
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title="Navegação mobile"
          description="O desktop usa Sidebar; no mobile a navegação pode ser recomposta neste Drawer."
        >
          <div className="yas-stack">
            <a href="#inicio">Início</a>
            <a href="#aulas">Aulas</a>
            <a href="#pratica">Prática</a>
          </div>
        </Drawer>
      </div>
    );
  },
};

export const SessionPrimitives: Story = {
  render: function SessionPrimitivesStory() {
    const [step, setStep] = useState(1);
    return (
      <MotionProvider>
        <div className="yas-stack" style={{ maxWidth: 820 }}>
          <Breadcrumbs
            homeHref="#inicio"
            items={[{ label: "Sessões", href: "#sessoes" }, { label: "Pronúncia do TH" }]}
          />
          <SegmentedNav
            ariaLabel="Visualização"
            value="week"
            items={[
              { id: "agenda", label: "Agenda", href: "#agenda" },
              { id: "week", label: "Semana", href: "#semana" },
              { id: "month", label: "Mês", href: "#mes" },
            ]}
          />
          <Tabs
            ariaLabel="Detalhes"
            variant="underline"
            items={[
              { id: "o", label: "Visão geral", icon: "grid", content: <p>Visão geral.</p> },
              { id: "p", label: "Participantes", icon: "users", badge: 2, content: <p>Lista.</p> },
              { id: "r", label: "Recursos", icon: "file", badge: 3, content: <p>Recursos.</p> },
            ]}
          />
          <Stepper
            ariaLabel="Etapas"
            current={step}
            onStepSelect={setStep}
            steps={[
              { label: "Informações", description: "Título, tipo e horário." },
              { label: "Turma e sala", description: "Participantes e link." },
              { label: "Revisão", description: "Confira antes de criar." },
            ]}
          />
          <div className="yas-cluster">
            <Button variant="outline" onClick={() => setStep((n) => Math.max(0, n - 1))}>
              Voltar
            </Button>
            <Button variant="secondary" onClick={() => setStep((n) => Math.min(2, n + 1))}>
              Continuar
            </Button>
            <Dropdown
              iconOnly
              label="Ações da sessão"
              items={[
                { id: "open", label: "Ver detalhes", icon: "eye" },
                { id: "cancel", label: "Cancelar sessão", icon: "x-c", destructive: true },
              ]}
            />
            <Dropdown
              label="Exportar relatório"
              icon="download"
              triggerVariant="primary"
              items={[
                { id: "csv", label: "Exportar CSV", icon: "file" },
                { id: "pdf", label: "Baixar PDF", icon: "download" },
              ]}
            />
          </div>
        </div>
      </MotionProvider>
    );
  },
};

export const Operations: Story = {
  render: () => (
    <div className="yas-stack" style={{ maxWidth: 1080 }}>
      <PageHeader
        title="Operações"
        description="Primitives compartilhados das superfícies Admin e Teacher."
        actions={
          <FormDialog trigger="Nova entrada" title="Criar entrada">
            <div className="yas-stack">
              <Input label="Nome" defaultValue="Aluno exemplo" />
              <Button type="button" variant="primary">
                Salvar
              </Button>
            </div>
          </FormDialog>
        }
      />
      <section className="yas-metric-strip" aria-label="Indicadores de operações">
        <MetricCard label="Ativos" value="12" detail="Registros disponíveis" />
        <MetricCard label="Pendentes" value="3" detail="Precisam de atenção" />
      </section>
      <FilterBar aria-label="Filtrar operações">
        <Input label="Buscar" placeholder="Nome ou e-mail" />
        <Button type="submit">Filtrar</Button>
      </FilterBar>
      <DataTable
        caption="Operações recentes"
        columns={[
          { id: "name", label: "Nome" },
          { id: "status", label: "Status" },
        ]}
        rows={[
          {
            id: "1",
            cells: [
              "Aluno exemplo",
              <Badge key="status" tone="success">
                Ativo
              </Badge>,
            ],
            mobile: (
              <Card>
                <strong>Aluno exemplo</strong>
                <Badge tone="success">Ativo</Badge>
              </Card>
            ),
          },
        ]}
      />
    </div>
  ),
};

export const ContentStates: Story = {
  render: () => (
    <div className="yas-stack" style={{ maxWidth: 820 }}>
      <Skeleton height="7rem" />
      <EmptyState
        title="Nenhum material encontrado"
        description="Tente remover alguns filtros ou volte para todos os materiais."
        action={{ label: "Ver todos", variant: "outline" }}
      />
      <ErrorState
        title="Não foi possível carregar"
        description="O problema foi registrado. Você pode tentar novamente sem perder seu progresso."
        action={{ label: "Tentar novamente", variant: "secondary" }}
      />
    </div>
  ),
};

export const LongTextAndFocus: Story = {
  render: () => (
    <div className="yas-stack" style={{ maxWidth: 620 }}>
      <Button variant="primary" autoFocus>
        Continuar para a próxima etapa da sua jornada de inglês com acompanhamento personalizado
      </Button>
      <Alert
        tone="warning"
        title="Texto longo continua legível"
        description="Componentes devem crescer com o conteúdo em vez de truncar informações essenciais apenas para preservar uma altura visual rígida."
      />
    </div>
  ),
};

export const MobileWidth: Story = {
  render: () => (
    <div style={{ width: 360, maxWidth: "100%" }} className="yas-stack">
      <PageHeader
        title="Materiais"
        description="Hierarquia preservada em uma largura de celular."
      />
      <Button variant="primary">Começar prática</Button>
      <Card>
        <SectionHeader title="Continue revisando" />
        <p>O card recompõe o conteúdo sem simular uma página completa.</p>
      </Card>
      <Input label="Buscar materiais" placeholder="PDF, resumo, vocabulário…" />
    </div>
  ),
};
