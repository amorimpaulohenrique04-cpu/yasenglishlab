import { spawnSync } from "node:child_process";

const suite = process.argv[2];
const suites = {
  integration: [
    "supabase/tests/notification_delivery.sql",
    "supabase/tests/billing_checkout.sql",
    "supabase/tests/domain_invariants.sql",
    "supabase/tests/vertical_slice_persistence.sql",
    "supabase/tests/practice_persistence.sql",
    "supabase/tests/schedule_booking.sql",
    "supabase/tests/booking_quota.sql",
    "supabase/tests/cohorts.sql",
    "supabase/tests/teacher_operations.sql",
    "supabase/tests/teacher_session_workspace.sql",
    "supabase/tests/admin_content.sql",
    "supabase/tests/assessment_engine.sql",
    "supabase/tests/students_directory.sql",
    "supabase/tests/teacher_students_workspace.sql",
    "supabase/tests/teacher_entry_workspace.sql",
    "supabase/tests/teacher_availability_workspace.sql",
    "supabase/tests/p21_core_experience.sql",
    "supabase/tests/placement.sql",
    "supabase/tests/placement_teacher_assignment.sql",
    "supabase/tests/cohort_unlimited.sql",
    "supabase/tests/welcome_catalog.sql",
    "supabase/tests/student_feedbacks.sql",
    "supabase/tests/operations_closure.sql",
    "supabase/tests/plan_change_requests.sql",
    "supabase/tests/billing_reconciliation.sql",
    "supabase/tests/reassessment_requests.sql",
    "supabase/tests/subscription_access.sql",
    "supabase/tests/enrollment_integrity.sql",
    "supabase/tests/admin_billing_operations.sql",
    "supabase/tests/live_booking_integrity.sql",
    "supabase/tests/subscription_cancellation.sql",
    "supabase/tests/rate_limit.sql",
    "supabase/tests/function_privileges.sql",
    "supabase/tests/sensitive_tables_negative.sql",
    "supabase/tests/record_immutability.sql",
    "supabase/tests/access_closure.sql",
    "supabase/tests/practice_authoring.sql",
    "supabase/tests/practice_lifecycle.sql",
    "supabase/tests/practice_items.sql",
    "supabase/tests/teacher_practices_redesign.sql",
    "supabase/tests/practice_review_schedule.sql",
    "supabase/tests/assessment_authoring.sql",
    "supabase/tests/cohort_path.sql",
    "supabase/tests/cohort_path_admin.sql",
    "supabase/tests/content_audience.sql",
    "supabase/tests/admin_course_enrollment.sql",
    "supabase/tests/plan_entitlement_admin.sql",
    "supabase/tests/operational_alerts.sql",
    "supabase/tests/billing_core.sql",
    "supabase/tests/observability_contracts.sql",
  ],
  rls: [
    "supabase/tests/notification_delivery.sql",
    "supabase/tests/billing_checkout.sql",
    "supabase/tests/cohorts.sql",
    "supabase/tests/rls_permissions.sql",
    "supabase/tests/teacher_operations.sql",
    "supabase/tests/teacher_session_workspace.sql",
    "supabase/tests/admin_content.sql",
    "supabase/tests/assessment_engine.sql",
    "supabase/tests/students_directory.sql",
    "supabase/tests/teacher_students_workspace.sql",
    "supabase/tests/teacher_entry_workspace.sql",
    "supabase/tests/teacher_availability_workspace.sql",
    "supabase/tests/p21_core_experience.sql",
    "supabase/tests/placement.sql",
    "supabase/tests/placement_teacher_assignment.sql",
    "supabase/tests/cohort_unlimited.sql",
    "supabase/tests/welcome_catalog.sql",
    "supabase/tests/student_feedbacks.sql",
    "supabase/tests/operations_closure.sql",
    "supabase/tests/plan_change_requests.sql",
    "supabase/tests/billing_reconciliation.sql",
    "supabase/tests/reassessment_requests.sql",
    "supabase/tests/admin_billing_operations.sql",
    "supabase/tests/rate_limit.sql",
    "supabase/tests/function_privileges.sql",
    "supabase/tests/sensitive_tables_negative.sql",
    "supabase/tests/record_immutability.sql",
    "supabase/tests/access_closure.sql",
    "supabase/tests/practice_authoring.sql",
    "supabase/tests/practice_lifecycle.sql",
    "supabase/tests/practice_items.sql",
    "supabase/tests/teacher_practices_redesign.sql",
    "supabase/tests/practice_review_schedule.sql",
    "supabase/tests/assessment_authoring.sql",
    "supabase/tests/cohort_path.sql",
    "supabase/tests/cohort_path_admin.sql",
    "supabase/tests/content_audience.sql",
    "supabase/tests/admin_course_enrollment.sql",
    "supabase/tests/plan_entitlement_admin.sql",
    "supabase/tests/operational_alerts.sql",
  ],
  "plan-entitlement-admin": ["supabase/tests/plan_entitlement_admin.sql"],
  "operational-alerts": ["supabase/tests/operational_alerts.sql"],
  "billing-core": ["supabase/tests/billing_core.sql"],
  "observability-contracts": ["supabase/tests/observability_contracts.sql"],
  "students-directory": ["supabase/tests/students_directory.sql"],
  "teacher-students-workspace": ["supabase/tests/teacher_students_workspace.sql"],
  "teacher-entry-workspace": ["supabase/tests/teacher_entry_workspace.sql"],
  "teacher-availability-workspace": ["supabase/tests/teacher_availability_workspace.sql"],
  "admin-teachers": ["supabase/tests/admin_teachers.sql"],
  "admin-cohorts": ["supabase/tests/admin_cohorts.sql"],
  "admin-crm": ["supabase/tests/admin_crm.sql"],
  "subscription-access": ["supabase/tests/subscription_access.sql"],
  "enrollment-integrity": ["supabase/tests/enrollment_integrity.sql"],
  "admin-billing-operations": ["supabase/tests/admin_billing_operations.sql"],
  "live-booking-integrity": ["supabase/tests/live_booking_integrity.sql"],
  "subscription-cancellation": ["supabase/tests/subscription_cancellation.sql"],
  "billing-checkout": ["supabase/tests/billing_checkout.sql"],
  "notification-delivery": ["supabase/tests/notification_delivery.sql"],
  "rate-limit": ["supabase/tests/rate_limit.sql"],
  "function-privileges": ["supabase/tests/function_privileges.sql"],
  "sensitive-tables-negative": ["supabase/tests/sensitive_tables_negative.sql"],
  "record-immutability": ["supabase/tests/record_immutability.sql"],
  "access-closure": ["supabase/tests/access_closure.sql"],
  "practice-authoring": ["supabase/tests/practice_authoring.sql"],
  "practice-lifecycle": ["supabase/tests/practice_lifecycle.sql"],
  "practice-items": ["supabase/tests/practice_items.sql"],
  "practice-review-schedule": ["supabase/tests/practice_review_schedule.sql"],
  "assessment-authoring": ["supabase/tests/assessment_authoring.sql"],
  "cohort-path": ["supabase/tests/cohort_path.sql"],
  "cohort-path-admin": ["supabase/tests/cohort_path_admin.sql"],
  "content-audience": ["supabase/tests/content_audience.sql"],
  "admin-course-enrollment": ["supabase/tests/admin_course_enrollment.sql"],
};

const files = suites[suite];
if (!files) {
  console.error(
    "Usage: node scripts/run-sql-tests.mjs <integration|rls|billing-core|observability-contracts|students-directory|teacher-students-workspace|teacher-entry-workspace|teacher-availability-workspace|admin-teachers|admin-cohorts|admin-crm|notification-delivery|subscription-access|enrollment-integrity|admin-billing-operations|subscription-cancellation|live-booking-integrity|rate-limit|function-privileges|sensitive-tables-negative|record-immutability|access-closure|practice-authoring|practice-lifecycle|practice-items|practice-review-schedule|assessment-authoring|cohort-path|cohort-path-admin|content-audience|admin-course-enrollment>",
  );
  process.exit(2);
}

const databaseUrl = process.env.DATABASE_URL;
const psqlArgs = databaseUrl ? [`--dbname=${databaseUrl}`] : [];
psqlArgs.push("-v", "ON_ERROR_STOP=1");

for (const file of files) {
  console.log(`\n▶ psql ${file}`);
  const result = spawnSync("psql", [...psqlArgs, "-f", file], {
    stdio: "inherit",
  });
  if (result.error?.code === "ENOENT") {
    console.error("psql is required for executable database/RLS tests.");
    process.exit(2);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (suite === "integration") {
  console.log("\n▶ real Agenda concurrency");
  const concurrency = spawnSync(process.execPath, ["scripts/test-schedule-concurrency.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (concurrency.status !== 0) process.exit(concurrency.status ?? 1);
}

if (suite === "integration") {
  const core = spawnSync(process.execPath, ["scripts/test-core-experience-concurrency.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (core.status !== 0) process.exit(core.status ?? 1);
  const placement = spawnSync(process.execPath, ["scripts/test-placement-concurrency.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (placement.status !== 0) process.exit(placement.status ?? 1);
  const notifications = spawnSync(
    process.execPath,
    ["scripts/test-notification-delivery-concurrency.mjs"],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
  if (notifications.status !== 0) process.exit(notifications.status ?? 1);
  const billingWebhook = spawnSync(
    process.execPath,
    ["scripts/test-billing-webhook-concurrency.mjs"],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
  if (billingWebhook.status !== 0) process.exit(billingWebhook.status ?? 1);
  const courseCompletion = spawnSync(
    process.execPath,
    ["scripts/test-course-completion-concurrency.mjs"],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
  if (courseCompletion.status !== 0) process.exit(courseCompletion.status ?? 1);
}
console.log(`\n✓ ${suite} SQL suite passed (${files.length} file(s)).`);
