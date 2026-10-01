export const YAS_SCHEDULE_TIME_ZONE = "America/Recife";

export type ScheduleSessionType =
  "CORE_CLASS" | "CONVERSATION_LAB" | "PRIVATE_SESSION" | "WORKSHOP";

export type ScheduleSessionStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";
export type ScheduleBookingStatus = "BOOKED" | "CANCELLED" | "TEACHER_CANCELLED";

export type ScheduleAvailability = "AVAILABLE" | "FULL" | "BOOKED" | "CLOSED";

export type ScheduleEligibilityReason = "ENTITLEMENT_REQUIRED" | null;

export interface ScheduleSessionRecord {
  id: string;
  sessionType: ScheduleSessionType;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: ScheduleSessionStatus;
  requiredEntitlementKey: string | null;
  bookedCount: number;
  spotsRemaining: number;
  ownBookingId: string | null;
  ownBookingStatus: ScheduleBookingStatus | null;
  hasRequiredEntitlement: boolean;
}

export interface ScheduleSessionView extends ScheduleSessionRecord {
  availability: ScheduleAvailability;
  eligibility: {
    canBook: boolean;
    reason: ScheduleEligibilityReason;
  };
}

export type ScheduleBookingErrorCode = "ENTITLEMENT_REQUIRED" | "FULL" | "CLOSED" | "UNAVAILABLE";

export class ScheduleBookingError extends Error {
  constructor(readonly code: ScheduleBookingErrorCode) {
    super(code);
    this.name = "ScheduleBookingError";
  }
}

export function deriveScheduleAvailability(input: {
  sessionStatus: ScheduleSessionStatus;
  ownBookingStatus: ScheduleBookingStatus | null;
  bookedCount: number;
  capacity: number;
}): ScheduleAvailability {
  if (input.sessionStatus !== "SCHEDULED") return "CLOSED";
  if (input.ownBookingStatus === "BOOKED") return "BOOKED";
  if (input.ownBookingStatus !== null) return "CLOSED";
  if (input.bookedCount >= input.capacity) return "FULL";
  return "AVAILABLE";
}

export function deriveScheduleEligibility(input: {
  requiredEntitlementKey: string | null;
  hasRequiredEntitlement: boolean;
}): ScheduleSessionView["eligibility"] {
  if (input.requiredEntitlementKey && !input.hasRequiredEntitlement) {
    return { canBook: false, reason: "ENTITLEMENT_REQUIRED" };
  }
  return { canBook: true, reason: null };
}

export function toScheduleSessionView(record: ScheduleSessionRecord): ScheduleSessionView {
  return {
    ...record,
    availability: deriveScheduleAvailability({
      sessionStatus: record.status,
      ownBookingStatus: record.ownBookingStatus,
      bookedCount: record.bookedCount,
      capacity: record.capacity,
    }),
    eligibility: deriveScheduleEligibility({
      requiredEntitlementKey: record.requiredEntitlementKey,
      hasRequiredEntitlement: record.hasRequiredEntitlement,
    }),
  };
}

export function scheduleSessionTypeLabel(type: ScheduleSessionType): string {
  if (type === "CORE_CLASS") return "Core Class";
  if (type === "CONVERSATION_LAB") return "Conversation Lab";
  if (type === "PRIVATE_SESSION") return "Sessão particular";
  return "Workshop";
}

export function scheduleAvailabilityLabel(status: ScheduleAvailability): string {
  if (status === "AVAILABLE") return "Disponível";
  if (status === "FULL") return "Lotado";
  if (status === "BOOKED") return "Reservado";
  return "Encerrado";
}
