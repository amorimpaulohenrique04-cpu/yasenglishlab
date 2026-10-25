import { z } from "zod";
export const alertKinds = [
  "COHORT_CONFIGURATION",
  "PLACEMENT_NO_COHORT",
  "STALE_REVIEW",
  "STALE_DECISION",
  "PLACEMENT_UNPUBLISHED",
  "COMPLETED_WITHOUT_NEXT",
  "PRACTICE_NO_REVIEWER",
] as const;
export const alertReasons = {
  MISSING_SETTINGS: "Turma sem horários de entrada configurados.",
  MISSING_RECOMMENDATION: "Recomendação pedagógica ainda indisponível.",
  COURSE_UNAVAILABLE: "Curso recomendado inativo ou não publicado.",
  NO_COHORT: "Nenhuma turma ativa do curso recomendado.",
  NO_SCHEDULE: "Turmas sem configuração de entrada.",
  NO_AVAILABILITY: "Aluno sem disponibilidade registrada.",
  NO_COMPATIBILITY: "Horários sem compatibilidade com a disponibilidade do aluno.",
  NO_CAPACITY: "Turmas compatíveis sem vaga.",
  REVIEW_OVER_3_DAYS: "Revisão aguardando há mais de 3 dias.",
  DECISION_OVER_7_DAYS: "Escolha de turma aguardando há mais de 7 dias.",
  UNPUBLISHED: "Selecione e publique uma versão do teste de entrada.",
  NO_ACTIVE_NEXT_COURSE: "Curso concluído sem outra matrícula ativa.",
  NO_REVIEWER: "Resposta escrita ou falada aguardando revisão sem professor designado.",
} as const;
export const operationalAlertsSchema = z
  .object({
    generatedAt: z.iso.datetime({ offset: true }),
    alerts: z
      .array(
        z.object({
          kind: z.enum(alertKinds),
          count: z.number().int().nonnegative(),
          items: z
            .array(
              z.object({
                id: z.guid().nullable(),
                label: z.string(),
                reason: z.enum(
                  Object.keys(alertReasons) as [
                    keyof typeof alertReasons,
                    ...(keyof typeof alertReasons)[],
                  ],
                ),
                since: z.iso.datetime({ offset: true }),
              }),
            )
            .max(10),
        }),
      )
      .length(alertKinds.length),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.alerts.map((a) => a.kind)).size !== alertKinds.length)
      ctx.addIssue({
        code: "custom",
        message: "Operational categories must be complete and unique",
      });
  });
export type OperationalAlerts = z.infer<typeof operationalAlertsSchema>;
export const alertPresentation = {
  COHORT_CONFIGURATION: {
    title: "Turmas sem configuração de entrada",
    href: "/admin/cohorts",
    action: "Configurar turmas",
  },
  PLACEMENT_NO_COHORT: {
    title: "Casos sem turma elegível",
    href: "/admin/enrollments?state=PLACEMENT_READY",
    action: "Consultar matrículas",
  },
  STALE_REVIEW: {
    title: "Revisões paradas",
    href: "/admin/enrollments?state=REVIEW_PENDING",
    action: "Consultar revisões",
  },
  STALE_DECISION: {
    title: "Escolhas de turma paradas",
    href: "/admin/enrollments?state=STUDENT_DECISION",
    action: "Consultar escolhas",
  },
  PLACEMENT_UNPUBLISHED: {
    title: "Teste de entrada não publicado",
    href: "/admin/assessments",
    action: "Gerenciar teste de entrada",
  },
  COMPLETED_WITHOUT_NEXT: {
    title: "Concluídos sem próximo curso",
    href: "/admin/students",
    action: "Consultar alunos",
  },
  PRACTICE_NO_REVIEWER: {
    title: "Práticas sem professor revisor",
    href: "/admin/teachers",
    action: "Designar professor",
  },
} as const;
