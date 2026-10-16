import type { ReactNode } from "react";

import { getStudentRequestContext } from "@/server/student/request-context";

/**
 * Tela cheia da prática (como nos apps de idioma): sem sidebar nem navegação do aluno, só a
 * atividade. Mesmas guardas do layout do aluno (sessão, MFA de staff, papel STUDENT).
 */
export default async function PracticeFocusLayout({ children }: { children: ReactNode }) {
  await getStudentRequestContext();
  return <main className="yas-practice-focus">{children}</main>;
}
