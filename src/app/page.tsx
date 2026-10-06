import Link from "next/link";
import { connection } from "next/server";
import { Card } from "@/components/ui";
import { publicPlans } from "@/server/commercial/plans";
import { price } from "@/modules/commercial/contracts";
import styles from "@/modules/commercial/commercial.module.css";

export const metadata = {
  title: "Inglês com direção e prática | Yas English Lab",
  description:
    "Uma jornada de inglês com aulas, prática e encontros ao vivo. Escolha seu plano e encontre o caminho para estudar com direção.",
};
export default async function RootPage() {
  await connection();
  let plans: Awaited<ReturnType<typeof publicPlans>> = [];
  try {
    plans = await publicPlans();
  } catch {
    /* No invented prices on failure. */
  }
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          Yas English Lab
        </Link>
        <nav className={styles.nav} aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <Link href="/login">Entrar</Link>
          <a className="yas-button yas-button--secondary" href="#planos">
            Começar agora
          </a>
        </nav>
      </header>
      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div>
            <p className={styles.eyebrow}>Inglês para a vida adulta</p>
            <h1 id="hero-title">Seu inglês merece um caminho claro.</h1>
            <p className={styles.lead}>
              Estude com direção, pratique com constância e leve o inglês para suas conversas. Aulas
              e encontros ao vivo conectados à sua jornada.
            </p>
            <a className="yas-button yas-button--secondary yas-button--lg" href="#planos">
              Começar agora
            </a>
          </div>
          <aside className={styles.journey} aria-labelledby="journey-title">
            <h2 id="journey-title">Seu caminho no Yas</h2>
            <ol>
              <li>Descubra seu ponto de partida com o teste de nível.</li>
              <li>Receba uma recomendação para sua jornada.</li>
              <li>Aprenda, pratique e encontre sua turma.</li>
            </ol>
          </aside>
        </section>
        <section id="como-funciona" className={styles.section} aria-labelledby="how-title">
          <p className={styles.eyebrow}>Passo a passo</p>
          <h2 id="how-title">Da escolha do plano à sua turma.</h2>
          <ol className={styles.steps}>
            <li>Escolha seu plano e crie sua conta.</li>
            <li>Conclua o pagamento e faça o teste de nível.</li>
            <li>Receba sua recomendação e siga para a turma.</li>
          </ol>
        </section>
        <section className={styles.section} aria-labelledby="study-title">
          <h2 id="study-title">Mais espaço para aprender e usar o inglês.</h2>
          <p className={styles.lead}>
            Aulas para construir sua base, atividades de prática e materiais para estudar. Acompanhe
            seu percurso e participe de encontros ao vivo conforme os benefícios do seu plano. O
            teste de nível orienta seu início.
          </p>
        </section>
        <section id="planos" className={styles.section} aria-labelledby="plans-title">
          <p className={styles.eyebrow}>Sua intensidade de estudo</p>
          <h2 id="plans-title">Escolha seu plano.</h2>
          <p>Planos mensais. Compare os encontros incluídos e encontre sua rotina.</p>
          <div className={styles.plans}>
            {plans.map((plan) => (
              <Card key={plan.code} className={styles.plan} aria-labelledby={`plan-${plan.code}`}>
                <h3 id={`plan-${plan.code}`}>{plan.name}</h3>
                <p>{plan.description}</p>
                <p className={styles.price}>
                  {price(plan)} <small>/ mês</small>
                </p>
                <ul>
                  {plan.benefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
                <Link
                  className="yas-button yas-button--secondary"
                  href={`/signup?plan=${encodeURIComponent(plan.code)}`}
                >
                  Escolher {plan.name}
                </Link>
              </Card>
            ))}
          </div>
          {!plans.length && (
            <p role="status">
              Os planos estão indisponíveis neste momento. Tente novamente mais tarde.
            </p>
          )}
        </section>
        <section className={styles.final} aria-labelledby="start-title">
          <h2 id="start-title">Comece pelo próximo passo.</h2>
          <p>Escolha a intensidade que faz sentido para sua rotina.</p>
          <a className="yas-button yas-button--secondary" href="#planos">
            Escolher meu plano
          </a>
        </section>
      </main>
      <footer className={styles.footer}>Yas English Lab · Aprender. Praticar. Conversar.</footer>
    </div>
  );
}
