import Link from "next/link";

import { Alert, EmptyState, Icon, PageHeader } from "@/components/ui";
import { PracticeList } from "@/modules/teacher-operations/ui/practice-list";
import styles from "@/modules/teacher-operations/ui/practice-list.module.css";
import { SAVE_ERROR_COPY } from "@/modules/teacher-operations/ui/practice-builder-logic";
import { assertRole } from "@/server/auth/guards";
import { listTeacherPractices } from "@/server/teacher-operations/practice-commands";

import { duplicatePracticeAction } from "./actions";

export default async function TeacherPracticesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await assertRole("TEACHER");
  const [items, query] = await Promise.all([listTeacherPractices(), searchParams]);
  const error =
    SAVE_ERROR_COPY[typeof query.reason === "string" ? query.reason : ""] ??
    SAVE_ERROR_COPY.UNAVAILABLE!;
  const status = typeof query.status === "string" ? query.status : "all";
  const search = typeof query.q === "string" ? query.q : "";
  const create = (
    <Link className="yas-button yas-button--secondary" href="/teacher/praticas/nova">
      <Icon name="plus" size={17} /> Nova prática
    </Link>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Práticas"
        description="Crie e organize atividades para as aulas dos seus alunos."
        actions={create}
      />
      {query.save === "error" && (
        <Alert tone="error" title={error.title} description={error.description} />
      )}
      {query.save === "success" && <Alert tone="success" title="Alteração concluída" />}
      {items.length === 0 ? (
        <section className={styles.emptyWrap} aria-labelledby="empty-title">
          <EmptyState
            title="Você ainda não criou práticas"
            description="Monte uma atividade e vincule-a à aula em que seus alunos vão praticar."
          />
        </section>
      ) : (
        <PracticeList
          items={items}
          status={status}
          search={search}
          duplicateAction={duplicatePracticeAction}
        />
      )}
    </div>
  );
}
