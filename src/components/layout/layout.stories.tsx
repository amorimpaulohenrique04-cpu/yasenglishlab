import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Avatar,
  Button,
  Card,
  IconButton,
  Input,
  PageHeader,
  SectionHeader,
} from "@/components/ui";

import { AppShell, ContentContainer, Sidebar, Topbar } from ".";

const meta = {
  title: "Design System/Layout",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function SimpleIcon({ label }: { label: string }) {
  return (
    <span aria-hidden="true" style={{ width: 20, textAlign: "center" }}>
      {label}
    </span>
  );
}

const items = [
  { id: "home", label: "Início", href: "#inicio", icon: <SimpleIcon label="⌂" />, active: true },
  { id: "classes", label: "Aulas", href: "#aulas", icon: <SimpleIcon label="▶" /> },
  { id: "practice", label: "Prática", href: "#pratica", icon: <SimpleIcon label="◉" /> },
  { id: "materials", label: "Materiais", href: "#materiais", icon: <SimpleIcon label="▤" /> },
  { id: "progress", label: "Progresso", href: "#progresso", icon: <SimpleIcon label="▥" /> },
];

export const DesktopShell: Story = {
  render: () => (
    <AppShell
      sidebar={
        <Sidebar brand={<span>Yas English Lab</span>} items={items} footer="Ajuda e suporte" />
      }
      topbar={
        <Topbar
          start={
            <div style={{ width: 360, maxWidth: "48vw" }}>
              <Input
                label="Busca"
                aria-label="Busca"
                placeholder="Buscar aulas, materiais, temas…"
              />
            </div>
          }
          end={
            <div className="yas-cluster">
              <IconButton label="Notificações">○</IconButton>
              <Avatar fallback="YO" alt="Yasmin Oliveira" />
            </div>
          }
        />
      }
    >
      <ContentContainer className="yas-stack">
        <PageHeader
          title="Olá, Yasmin"
          description="Shell e ritmo visual — não é a implementação da Home."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.5fr) minmax(16rem, 1fr)",
            gap: 16,
          }}
        >
          <Card variant="accent">
            <SectionHeader title="Próxima ação" />
            <p>Um conteúdo de exemplo demonstra apenas superfície, espaçamento e hierarquia.</p>
            <Button variant="primary">Continuar</Button>
          </Card>
          <Card>
            <SectionHeader title="Resumo" />
            <p>Cards brancos sobre o fundo lilás permanecem a superfície padrão.</p>
          </Card>
        </div>
      </ContentContainer>
    </AppShell>
  ),
};

export const MobileShell: Story = {
  render: () => (
    <div
      style={{
        width: 390,
        maxWidth: "100%",
        margin: "0 auto",
        minHeight: 760,
        background: "var(--yas-color-canvas)",
      }}
    >
      <Topbar
        start={<IconButton label="Abrir menu">☰</IconButton>}
        end={
          <div className="yas-cluster">
            <IconButton label="Notificações">○</IconButton>
            <Avatar fallback="YO" alt="Yasmin Oliveira" />
          </div>
        }
      />
      <ContentContainer className="yas-stack">
        <PageHeader
          title="Olá, Yasmin"
          description="No mobile, a Sidebar desaparece e a navegação deve ser recomposta via Drawer."
        />
        <Card variant="accent">
          <SectionHeader title="Próxima ação" />
          <p>Conteúdo empilhado preserva prioridade e leitura.</p>
          <Button variant="primary">Continuar</Button>
        </Card>
        <Card>
          <SectionHeader title="Resumo" />
          <p>Baixa densidade e respiro continuam no viewport estreito.</p>
        </Card>
      </ContentContainer>
    </div>
  ),
};
