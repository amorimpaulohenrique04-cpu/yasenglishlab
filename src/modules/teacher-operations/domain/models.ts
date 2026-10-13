export const TEACHER_ATTENDANCE_STATUSES = ["ATTENDED", "NO_SHOW"] as const;

export type TeacherAttendanceStatus = (typeof TEACHER_ATTENDANCE_STATUSES)[number];
export type TeacherSessionType = "CORE_CLASS" | "CONVERSATION_LAB" | "PRIVATE_SESSION" | "WORKSHOP";
export type TeacherSessionStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";
export type TeacherBookingStatus = "BOOKED" | "CANCELLED" | "TEACHER_CANCELLED";

export interface TeacherSessionRecord {
  id: string;
  sessionType: TeacherSessionType;
  title: string;
  startsAt: string;
  endsAt: string;
  status: TeacherSessionStatus;
  participantCount: number;
  attendanceMarkedCount: number;
}

export interface TeacherRosterRecord {
  bookingId: string;
  displayName: string;
  bookingStatus: TeacherBookingStatus;
  attendanceId: string | null;
  attendanceStatus: TeacherAttendanceStatus | null;
  attendanceMarkedAt: string | null;
}

export interface TeacherAttendanceMutation {
  attendanceId: string;
  status: TeacherAttendanceStatus;
  markedAt: string;
}

export type TeacherOperationsErrorCode =
  | "FORBIDDEN"
  | "INVALID_BOOKING"
  | "ATTENDANCE_TOO_EARLY"
  | "REASON_REQUIRED"
  | "REASON_INVALID"
  | "SESSION_NOT_CANCELLABLE"
  | "UNAVAILABLE";

export const TEACHER_ATTENDANCE_ERROR_MESSAGES: Record<TeacherOperationsErrorCode, string> = {
  FORBIDDEN: "Você não tem permissão para alterar esta presença.",
  INVALID_BOOKING: "A reserva não está ativa para registrar presença.",
  ATTENDANCE_TOO_EARLY: "A presença só pode ser marcada a partir do início da sessão.",
  REASON_REQUIRED: "Informe o motivo da correção para alterar uma presença já marcada.",
  REASON_INVALID: "O motivo da correção deve ter entre 3 e 500 caracteres.",
  SESSION_NOT_CANCELLABLE: "Só é possível cancelar sessões agendadas e sem presença registrada.",
  UNAVAILABLE: "A operação não pôde ser persistida com segurança. Tente novamente.",
};

export class TeacherOperationsError extends Error {
  constructor(readonly code: TeacherOperationsErrorCode) {
    super(code);
    this.name = "TeacherOperationsError";
  }
}

export function teacherSessionTypeLabel(type: TeacherSessionType): string {
  if (type === "CORE_CLASS") return "Core Class";
  if (type === "CONVERSATION_LAB") return "Conversation Lab";
  if (type === "PRIVATE_SESSION") return "Sessão particular";
  return "Workshop";
}

export function teacherSessionStatusLabel(status: TeacherSessionStatus): string {
  if (status === "SCHEDULED") return "Agendada";
  if (status === "COMPLETED") return "Concluída";
  return "Cancelada";
}

export function teacherAttendanceLabel(status: TeacherAttendanceStatus | null): string {
  if (status === "ATTENDED") return "Presente";
  if (status === "NO_SHOW") return "Ausente";
  return "Não marcada";
}
