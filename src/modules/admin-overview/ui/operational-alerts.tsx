import Link from "next/link";
import { Alert, Badge, Card, SectionHeader } from "@/components/ui";
import {
  alertPresentation,
  alertReasons,
  type OperationalAlerts as Model,
} from "../domain/operational-alerts";
import styles from "@/app/(protected)/(admin)/admin/admin-overview.module.css";
export function OperationalAlerts({ data }: { data: Model | null }) {
  return (
    <section className="yas-stack" aria-label="Alertas operacionais">
      <SectionHeader
        title="Alertas operacionais"
        description="Pendências de configuração e próximos passos da operação."
      />
      {data ? (
        <div className={styles.metricGrid}>
          {data.alerts.map((alert) => {
            const presentation = alertPresentation[alert.kind];
            return (
              <Card key={alert.kind} className="yas-stack" aria-label={presentation.title}>
                <h3>{presentation.title}</h3>
                <Badge tone={alert.count ? "warning" : "success"}>
                  {alert.count} {alert.count === 1 ? "pendência" : "pendências"}
                </Badge>
                {alert.count === 0 ? (
                  <p>Sem pendências nesta categoria.</p>
                ) : (
                  <>
                    <ul>
                      {alert.items.slice(0, 3).map((item, index) => (
                        <li key={item.id ?? index}>
                          <strong>{item.label}</strong>
                          <p>{alertReasons[item.reason]}</p>
                        </li>
                      ))}
                    </ul>
                    <p>
                      Exibindo {Math.min(alert.items.length, 3)} de {alert.count}.
                    </p>
                  </>
                )}
                <Link className={styles.panelLink} href={presentation.href}>
                  {presentation.action} →
                </Link>
              </Card>
            );
          })}
        </div>
      ) : (
        <Alert
          tone="error"
          title="Alertas temporariamente indisponíveis"
          description="Recarregue a página. As demais filas continuam disponíveis; não foi possível confirmar estas pendências."
        />
      )}
    </section>
  );
}
