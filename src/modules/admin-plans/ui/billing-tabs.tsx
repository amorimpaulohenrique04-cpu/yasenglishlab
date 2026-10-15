import Link from "next/link";
import styles from "@/modules/admin-content/ui/admin-content.module.css";
export function BillingTabs({ plans = false }: { plans?: boolean }) {
  return (
    <nav className={styles.kindNav} aria-label="Áreas de pagamentos">
      <Link
        className={styles.kindLink}
        href="/admin/billing"
        aria-current={!plans ? "page" : undefined}
      >
        Assinaturas e operação
      </Link>
      <Link
        className={styles.kindLink}
        href="/admin/billing?tab=plans"
        aria-current={plans ? "page" : undefined}
      >
        Planos e direitos
      </Link>
    </nav>
  );
}
