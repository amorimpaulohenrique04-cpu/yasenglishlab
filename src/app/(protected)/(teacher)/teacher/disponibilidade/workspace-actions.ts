"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  availabilityCommandSchema,
  availabilityErrorMessages,
  availabilityMutationSchema,
  classifyAvailabilityResultCode,
  classifyAvailabilityRpcError,
  type AvailabilityActionResult,
  type AvailabilityErrorCode,
} from "@/modules/teacher-operations/domain/availability-workspace";

const fail = (
  code: AvailabilityErrorCode,
  message = availabilityErrorMessages[code],
  conflicts: Extract<AvailabilityActionResult, { ok: false }>["conflicts"] = [],
): AvailabilityActionResult => ({ ok: false, code, message, conflicts });

export async function mutateAvailabilityWorkspace(
  operationId: string,
  input: unknown,
): Promise<AvailabilityActionResult> {
  await assertRole("TEACHER");
  const command = availabilityCommandSchema.safeParse(input);
  if (!z.uuid().safeParse(operationId).success || !command.success) return fail("validation");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("mutate_teacher_availability", {
    p_operation_id: operationId,
    p_input: command.data,
  });
  if (error) return fail(classifyAvailabilityRpcError(error));
  const parsed = availabilityMutationSchema.safeParse(data);
  if (!parsed.success) return fail("unknown");
  const result = parsed.data;
  if (!result.ok) {
    const code = classifyAvailabilityResultCode(result.code);
    return fail(code, result.message || availabilityErrorMessages[code], result.conflicts);
  }
  revalidatePath("/teacher/disponibilidade");
  revalidatePath("/teacher/sessoes");
  revalidatePath("/teacher/sessoes/nova");
  return result;
}
