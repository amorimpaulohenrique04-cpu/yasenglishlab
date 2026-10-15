import Link from "next/link";
import styles from "./admin-plans.module.css";
export function BillingTabs({ plans = false }: { plans?: boolean }) {
  return (
    <nav className={styles.tabs} aria-label="Áreas de pagamentos">
      <Link className={styles.tab} href="/admin/billing" aria-current={!plans ? "page" : undefined}>
        Assinaturas e operação
      </Link>
      <Link
        className={styles.tab}
        href="/admin/billing?tab=plans"
        aria-current={plans ? "page" : undefined}
      >
        Planos e direitos
      </Link>
    </nav>
  );
}
