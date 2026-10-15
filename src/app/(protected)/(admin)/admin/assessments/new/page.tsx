import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { AssessmentEditor } from "@/modules/admin-assessments/ui/assessment-editor";
import { saveAssessmentAction } from "../actions";
import styles from "@/modules/admin-content/ui/admin-content.module.css";
export default function NewAssessmentPage() {
  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/admin/assessments">
        ← Voltar para avaliações
      </Link>
      <PageHeader
        title="Nova avaliação"
        description="Salve um rascunho antes de publicar como teste de entrada."
      />
      <AssessmentEditor detail={null} action={saveAssessmentAction} />
    </div>
  );
}
