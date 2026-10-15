import Link from "next/link";

import { Card, IconBadge, PageHeader } from "@/components/ui";
import { requirePageAuth } from "@/server/auth/guards";

export const metadata = { title: "Suporte | Yas English Lab" };

// Guidance only (docs/UI_CONTRACT.md, Etapa 11). The official support channel is still an open decision
// (docs/OPEN_QUESTIONS.md), so this page never shows an e-mail, phone, WhatsApp or external URL.
export default async function SupportPage() {
  const auth = await requirePageAuth();
  const isStudent = auth.roles.includes("STUDENT");

  return (
    <div className="yas-account-page">
      <PageHeader
        title="Suporte"
        description="Orientações para as situações mais comuns. O canal oficial de atendimento será publicado nesta página."
      />

      <div className="yas-account-grid">
        {isStudent && (
          <Card>
            <div className="yas-card-header">
              <h2 className="yas-card-title">Pagamento e acesso</h2>
            </div>
            <ul className="yas-list yas-account-help">
              <li>
                <IconBadge icon="card" tone="yellow" shape="square" size="sm" />
                <span>
                  Pagamento pendente: assim que o pagamento for confirmado, o acesso volta sozinho e
                  você retoma de onde parou.
                </span>
              </li>
              <li>
                <IconBadge icon="history" shape="square" size="sm" />
                <span>
                  Assinatura encerrada ou cancelada: seu progresso continua guardado. Para voltar,
                  escolha um plano em{" "}
                  <Link className="yas-link" href="/checkout">
                    Pagamento
                  </Link>
                  .
                </span>
              </li>
              <li>
                <IconBadge icon="user" tone="blue" shape="square" size="sm" />
                <span>
                  Acompanhe o estado da sua assinatura em{" "}
                  <Link className="yas-link" href="/profile">
                    Seu perfil
                  </Link>
                  .
                </span>
              </li>
            </ul>
          </Card>
        )}

        <Card>
          <div className="yas-card-header">
            <h2 className="yas-card-title">Conta</h2>
          </div>
          <ul className="yas-list yas-account-help">
            <li>
              <IconBadge icon="pen" tone="green" shape="square" size="sm" />
              <span>
                Para alterar nome, idioma ou fuso horário, use{" "}
                <Link className="yas-link" href="/profile">
                  Seu perfil
                </Link>
                .
              </span>
            </li>
            <li>
              <IconBadge icon="lock" tone="pink" shape="square" size="sm" />
              <span>
                Esqueceu a senha? Saia da conta e use{" "}
                <Link className="yas-link" href="/forgot-password">
                  Recuperar senha
                </Link>
                .
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
