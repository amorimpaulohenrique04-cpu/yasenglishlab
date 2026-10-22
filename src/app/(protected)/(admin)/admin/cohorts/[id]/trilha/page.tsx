import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { CohortPathEditor } from "@/modules/admin-cohort-path/ui/cohort-path-editor";
import { getAdminCohortPath } from "@/server/admin-cohort-path/admin-cohort-path";
import { saveCohortPathAction } from "./actions";

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CohortPathPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!guidPattern.test(id)) notFound();
  const detail = await getAdminCohortPath(id).catch(() => null);
  if (!detail) notFound();
  return (
    <div className="yas-operational-surface">
      <Link className="yas-back-link" href="/admin/cohorts">
        ← Voltar para turmas
      </Link>
      <PageHeader
        title={`Trilha de ${detail.cohortName}`}
        description="Defina o que a turma enxerga do curso, a ordem e quando cada item é liberado."
      />
      <CohortPathEditor detail={detail} action={saveCohortPathAction} />
    </div>
  );
}
