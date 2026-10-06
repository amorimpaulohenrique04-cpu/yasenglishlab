"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import {
  registerStudent,
  ensurePublicStudentRole,
  readRegistrationRetry,
} from "@/server/commercial/signup";
import { selectedPlan } from "@/server/commercial/plans";
import { checkoutPath } from "@/modules/commercial/contracts";

export type SignupState = {
  status: "initial" | "invalid" | "email" | "retry" | "unavailable";
  errors?: Record<string, string[] | undefined>;
};
export async function signupAction(_previous: SignupState, form: FormData): Promise<SignupState> {
  let result: Awaited<ReturnType<typeof registerStudent>>;
  try {
    result = await registerStudent(
      {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        confirmPassword: form.get("confirmPassword"),
        plan: form.get("plan") || undefined,
      },
      await createSupabaseServerClient(),
      createSupabaseAdminClient(),
      async (code) => Boolean(await selectedPlan(code)),
    );
  } catch {
    return { status: "unavailable" };
  }
  if (result.kind === "retry") {
    (await cookies()).set("yas-registration-retry", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/signup",
      maxAge: 900,
    });
    return { status: "retry" };
  }
  if (result.kind === "session") redirect(result.destination);
  if (result.kind === "invalid") return { status: "invalid", errors: result.errors };
  return { status: "email" };
}
export async function retryRegistrationAction(): Promise<SignupState> {
  const jar = await cookies();
  const capability = readRegistrationRetry(jar.get("yas-registration-retry")?.value);
  if (!capability) return { status: "unavailable" };
  try {
    await ensurePublicStudentRole(capability.userId, createSupabaseAdminClient());
  } catch {
    return { status: "retry" };
  }
  jar.set("yas-registration-retry", "", { path: "/signup", maxAge: 0 });
  const auth = await createSupabaseServerClient();
  const { data } = await auth.auth.getUser();
  if (data.user?.id === capability.userId) redirect(checkoutPath(capability.plan));
  return { status: "email" };
}
