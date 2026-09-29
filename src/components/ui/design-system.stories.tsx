import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Drawer,
  Dropdown,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  ProgressBar,
  ProgressRing,
  Radio,
  SectionHeader,
  Select,
  SelectableTag,
  Skeleton,
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
            <Avatar fallback="YA" alt="Yasmin" size="lg" />
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
