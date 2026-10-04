import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cohortAdministrationRowSchema,
  type CohortCommand,
  type CohortAdministrationRow,
  type CohortOptions,
  type CohortRepository,
} from "@/modules/cohorts";

export class SupabaseCohortRepository implements CohortRepository {
  constructor(private readonly client: SupabaseClient) {}
  async list(limit = 25, offset = 0, query = ""): Promise<CohortAdministrationRow[]> {
    const { data, error } = await this.client.rpc("admin_cohort_directory", {
      p_limit: limit,
      p_offset: offset,
      p_query: query.trim() || null,
    });
    if (error) throw new Error("Unable to load authorized cohorts.");
    const rows: unknown[] = data ?? [];
    return rows.map((row: unknown) => cohortAdministrationRowSchema.parse(row));
  }
  async options(): Promise<CohortOptions> {
    const [courses, roles, teachers] = await Promise.all([
      this.client.from("courses").select("id,title").eq("active", true).order("title").limit(100),
      this.client
        .from("user_roles")
        .select("user_id,role")
        .eq("role", "STUDENT")
        .order("user_id")
        .limit(500),
      this.client.from("teachers").select("id,user_id").eq("active", true).order("id").limit(100),
    ]);
    const userIds = [
      ...new Set([
        ...(roles.data ?? []).map((role) => role.user_id),
        ...(teachers.data ?? []).map((teacher) => teacher.user_id),
      ]),
    ];
    const profiles = userIds.length
      ? await this.client.from("profiles").select("user_id,display_name").in("user_id", userIds)
      : { data: [], error: null };
    if ([courses, roles, teachers, profiles].some((result) => result.error))
      throw new Error("Unable to load cohort administration choices.");
    const names = new Map(
      (profiles.data ?? []).map((profile) => [profile.user_id, profile.display_name]),
    );
    return {
      courses: (courses.data ?? []).map((course) => ({ value: course.id, label: course.title })),
      students: (roles.data ?? []).map((role) => ({
        value: role.user_id,
        label: names.get(role.user_id) ?? "Aluno",
      })),
      teachers: (teachers.data ?? []).map((teacher) => ({
        value: teacher.id,
        label: names.get(teacher.user_id) ?? "Professor",
      })),
    };
  }
  async manage(command: CohortCommand): Promise<string> {
    const { data, error } = await this.client.rpc("manage_cohort", {
      p_operation: command.operation,
      p_cohort_id: command.cohortId,
      p_input: command.input,
    });
    if (error || typeof data !== "string")
      throw new Error(
        "A operação da turma não pôde ser concluída. Confira a matrícula, os vínculos e os dados informados.",
      );
    return data;
  }
  async configure(
    cohortId: string,
    capacity: number,
    schedule: { weekday: number; startMinute: number; endMinute: number }[],
  ) {
    const { error } = await this.client.rpc("configure_cohort_placement", {
      p_cohort_id: cohortId,
      p_capacity: capacity,
      p_schedule: schedule,
    });
    if (error) throw new Error("Unable to configure cohort schedule or capacity.");
  }
  async setPrimaryTeacher(cohortId: string, teacherId: string) {
    const { data, error } = await this.client.rpc("set_primary_cohort_teacher", {
      p_cohort_id: cohortId,
      p_teacher_id: teacherId,
    });
    if (error || typeof data !== "string") throw new Error("Unable to change primary Teacher.");
  }
}
