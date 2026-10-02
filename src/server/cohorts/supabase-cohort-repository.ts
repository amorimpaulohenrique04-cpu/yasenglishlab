import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cohortSchema,
  type CohortCommand,
  type CohortOptions,
  type CohortRepository,
} from "@/modules/cohorts";

export class SupabaseCohortRepository implements CohortRepository {
  constructor(private readonly client: SupabaseClient) {}
  async list() {
    const { data, error } = await this.client
      .from("cohorts")
      .select("id,course_id,name,code,status,timezone,starts_at,ends_at")
      .order("name");
    if (error) throw new Error("Unable to load authorized cohorts.");
    return (data ?? []).map((row) => cohortSchema.parse(row));
  }
  async options(): Promise<CohortOptions> {
    const [courses, profiles, roles, teachers] = await Promise.all([
      this.client.from("courses").select("id,title").order("title"),
      this.client.from("profiles").select("user_id,display_name").order("display_name"),
      this.client.from("user_roles").select("user_id,role").eq("role", "STUDENT"),
      this.client.from("teachers").select("id,user_id").eq("active", true),
    ]);
    if ([courses, profiles, roles, teachers].some((result) => result.error))
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
}
