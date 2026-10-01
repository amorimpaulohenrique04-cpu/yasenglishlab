import { redirect } from "next/navigation";

import { Alert } from "@/components/ui";
import { adminContentErrorCopy } from "@/modules/admin-content/ui/error-copy";
import { isAdminContentKind } from "@/modules/admin-content";
import { ContentEditor, type ParentChoices } from "@/modules/admin-content/ui/content-editor";
import { loadAdminContent } from "@/server/admin-content/admin-content";

import { saveContentAction } from "../actions";

interface NewContentPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewContentPage({ searchParams }: NewContentPageProps) {
  const query = await searchParams;
  const kind = first(query.kind);
  if (!isAdminContentKind(kind)) redirect("/admin/content?kind=courses");

  const choices: ParentChoices = {};
  if (kind === "modules") choices.courses = await loadAdminContent("courses");
  if (kind === "lessons") choices.modules = await loadAdminContent("modules");
  if (kind === "lesson_assets") choices.lessons = await loadAdminContent("lessons");
  if (kind === "materials" || kind === "practice_activities") {
    [choices.modules, choices.lessons] = await Promise.all([
      loadAdminContent("modules"),
      loadAdminContent("lessons"),
    ]);
  }

  return (
    <>
      {adminContentErrorCopy(first(query.error)) && (
        <Alert
          tone="error"
          title="Não foi possível criar o rascunho"
          description={adminContentErrorCopy(first(query.error))!}
        />
      )}
      <ContentEditor kind={kind} record={null} choices={choices} action={saveContentAction} />
    </>
  );
}
