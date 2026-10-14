import Link from "next/link";

import { Card, SectionHeader } from "@/components/ui";
import { requirePageAuth } from "@/server/auth/guards";

export const metadata = { title: "Suporte | Yas English Lab" };

// Guidance only (docs/UI_CONTRACT.md, Etapa 11). The official support channel is still an open decision
// (docs/OPEN_QUESTIONS.md), so this page never shows an e-mail, phone, WhatsApp or external URL.
export default async function SupportPage() {
  const auth = await requirePageAuth();
  const isStudent = auth.roles.includes("STUDENT");

  return (
    <main className="yas-profile-shell">
      <div className="yas-profile-grid">
        <div>
          <p className="yas-auth-eyebrow">Yas English Lab</p>
          <h1 className="yas-auth-title">Suporte</h1>
          <p className="yas-profile-meta">
            Orientações para as situações mais comuns. O canal oficial de atendimento será publicado
            nesta página.
          </p>
        </div>

        {isStudent && (
          <Card>
            <div className="yas-stack">
              <SectionHeader title="Pagamento e acesso" />
              <ul className="yas-stack">
                <li>
                  Pagamento pendente: assim que o pagamento for confirmado, o acesso volta sozinho e
                  você retoma de onde parou.
                </li>
                <li>
                  Assinatura encerrada ou cancelada: seu progresso continua guardado. Para voltar,
                  escolha um plano em{" "}
                  <Link className="yas-focusable" href="/checkout">
                    Pagamento
                  </Link>
                  .
                </li>
                <li>
                  Acompanhe o estado da sua assinatura em{" "}
                  <Link className="yas-focusable" href="/profile">
                    Seu perfil
                  </Link>
                  .
                </li>
              </ul>
            </div>
          </Card>
        )}

        <Card>
          <div className="yas-stack">
            <SectionHeader title="Conta" />
            <ul className="yas-stack">
              <li>
                Para alterar nome, idioma ou fuso horário, use{" "}
                <Link className="yas-focusable" href="/profile">
                  Seu perfil
                </Link>
                .
              </li>
              <li>
                Esqueceu a senha? Saia da conta e use{" "}
                <Link className="yas-focusable" href="/forgot-password">
                  Recuperar senha
                </Link>
                .
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </main>
  );
}
