export const PRIVILEGED_AUDIT_ACTIONS = {
  ROLE_CHANGE: "role_change",
  ENTITLEMENT_CHANGE: "entitlement_change",
  MANUAL_SUBSCRIPTION_CHANGE: "manual_subscription_change",
  TEACHER_ASSIGNMENT: "teacher_assignment",
  ASSESSMENT_PUBLICATION: "assessment_publication",
  ADMIN_DATA_EXPORT: "admin_data_export",
} as const;

export const SECURITY_AUDIT_ACTIONS = {
  ATTENDANCE_MARKED: "attendance_marked",
  LIVE_SESSION_BOOKED: "live_session_booked",
  PROTECTED_ASSET_ACCESS_GRANTED: "protected_asset_access_granted",
  PASSWORD_UPDATED: "PASSWORD_UPDATED",
  PROFILE_UPDATED: "PROFILE_UPDATED",
} as const;

export type AuditAction =
  | (typeof PRIVILEGED_AUDIT_ACTIONS)[keyof typeof PRIVILEGED_AUDIT_ACTIONS]
  | (typeof SECURITY_AUDIT_ACTIONS)[keyof typeof SECURITY_AUDIT_ACTIONS];
