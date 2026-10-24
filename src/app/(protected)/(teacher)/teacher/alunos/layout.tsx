import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion";
import { ToastProvider } from "@/components/ui";
export default function TeacherStudentsLayout({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <ToastProvider>{children}</ToastProvider>
    </MotionProvider>
  );
}
