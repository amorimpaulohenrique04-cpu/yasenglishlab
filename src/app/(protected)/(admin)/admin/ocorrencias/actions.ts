"use server";

import { revalidatePath } from "next/cache";

import { assertRole } from "@/server/auth/guards";

import { acknowledgeIncident, resolveIncident } from "@/server/operations/operations";

export async function acknowledgeIncidentAction(form: FormData) {
  await assertRole("ADMIN");
  await acknowledgeIncident(form.get("incidentId"));
  revalidatePath("/admin/ocorrencias");
}

export async function resolveIncidentAction(form: FormData) {
  await assertRole("ADMIN");
  await resolveIncident(form.get("incidentId"), form.get("evidence"));
  revalidatePath("/admin/ocorrencias");
}
