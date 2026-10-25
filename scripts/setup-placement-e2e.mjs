import { createClient } from "@supabase/supabase-js";
import { runAdmin } from "./_postgres-concurrency.mjs";

// Run by setup-canonical-e2e.mjs, or alone to restore only the placement journeys (initial, resume,
// review pending, placement ready) after a suite has reviewed them.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.CANONICAL_E2E_PASSWORD;
const courseId = "40000000-0000-4000-8000-000000000001";
const teacherId = "88000000-0000-4000-8000-000000000001";
const teacherEmail = "canonical.teacher@example.test";

if (!url || !serviceRoleKey || !password) {
  throw new Error("Placement fixtures require local Supabase credentials and generated password.");
}

// Placement fixtures are isolated local data, reset transactionally between suites.
// No runtime policy/grant changes and no production seed data.
if (
  !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url) ||
  !process.env.DATABASE_URL?.includes("127.0.0.1")
) {
  throw new Error("Placement fixtures require an explicitly local database and Data API.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw listError;

async function ensureUser(userEmail, displayName) {
  const existing = listed.users.find((candidate) => candidate.email === userEmail);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error || !data.user) throw error ?? new Error(`Unable to reset ${userEmail}.`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) throw error ?? new Error(`Unable to create ${userEmail}.`);
  return data.user;
}

const teacherUser = listed.users.find((candidate) => candidate.email === teacherEmail);
if (!teacherUser) throw new Error("Placement fixtures require the canonical Teacher.");
const placementUsers = [];
for (const [suffix, name] of [
  ["new", "Placement New"],
  ["resume", "Placement Resume"],
  ["pending", "Placement Pending"],
  ["ready", "Placement Ready"],
]) {
  const student = await ensureUser(`canonical.placement-${suffix}@example.test`, name);
  placementUsers.push(student);
}
const fixtureUsers = placementUsers.map((u) => `'${u.id}'`).join(",");
runAdmin(`begin;
 alter table public.placement_reviews disable trigger review_immutable;
 alter table public.placement_decisions disable trigger decision_immutable;
 alter table public.placement_transfers disable trigger transfer_immutable;
 alter table public.assessment_responses disable trigger assessment_response_guard;
 delete from public.placement_transfers where placement_case_id in(select id from public.placement_cases where user_id in(${fixtureUsers}));
 delete from public.placement_decisions where placement_case_id in(select id from public.placement_cases where user_id in(${fixtureUsers}));
 delete from public.placement_reviews where placement_case_id in(select id from public.placement_cases where user_id in(${fixtureUsers}));
 delete from public.student_schedule_preferences where placement_case_id in(select id from public.placement_cases where user_id in(${fixtureUsers}));
 delete from public.placement_review_drafts where placement_case_id in(select id from public.placement_cases where user_id in(${fixtureUsers}));
 delete from public.placement_cases where user_id in(${fixtureUsers});
 delete from public.cohort_memberships where user_id in(${fixtureUsers});
 delete from public.enrollments where user_id in(${fixtureUsers});
 delete from public.assessment_responses where assessment_attempt_id in(select id from public.assessment_attempts where user_id in(${fixtureUsers}));
 delete from public.skill_scores where assessment_attempt_id in(select id from public.assessment_attempts where user_id in(${fixtureUsers}));
 delete from public.assessment_attempts where user_id in(${fixtureUsers});
 alter table public.placement_reviews enable trigger review_immutable;
 alter table public.placement_decisions enable trigger decision_immutable;
 alter table public.placement_transfers enable trigger transfer_immutable;
 alter table public.assessment_responses enable trigger assessment_response_guard;
 commit;`);
const placementAssessmentId = "9a200000-0000-4000-8000-000000000001",
  placementVersionId = "9a300000-0000-4000-8000-000000000001";
const placementObjectiveId = "9a400000-0000-4000-8000-000000000001",
  placementManualId = "9a400000-0000-4000-8000-000000000002";
runAdmin(`update public.assessments set is_placement=false where is_placement and active and id<>'${placementAssessmentId}';
 insert into public.assessments(id,slug,title,purpose,is_placement) values('${placementAssessmentId}','canonical-placement','Canonical Placement','Synthetic initial journey, no validated CEFR',true) on conflict(id) do update set is_placement=true,active=true;
 insert into public.assessment_versions(id,assessment_id,version_number,status,specification,scoring_config) values('${placementVersionId}','${placementAssessmentId}',1,'DRAFT','{}','{"private":true}') on conflict(id) do nothing;
 do $$begin if (select status from public.assessment_versions where id='${placementVersionId}')='DRAFT' then
 insert into public.assessment_items(id,assessment_version_id,position,skill,item_type,prompt,answer_key,rubric) values
 ('${placementObjectiveId}','${placementVersionId}',1,'GRAMMAR','MULTIPLE_CHOICE','{"prompt":"Choose the correct sentence.","options":[{"id":"a","label":"I work from home."},{"id":"b","label":"I works from home."}]}','{"optionId":"a"}',null),
 ('${placementManualId}','${placementVersionId}',2,'SPEAKING','MANUAL_TEXT','{"prompt":"Describe your daily routine.","instructions":"Write a short response for the Teacher."}',null,'{"instructions":"Review the human response; no automatic CEFR."}');
 update public.assessment_versions set status='PUBLISHED',published_at=now() where id='${placementVersionId}';end if;end$$;
 insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 ('9a500000-0000-4000-8000-000000000001','${courseId}','Placement Monday','canonical-placement-monday','ACTIVE',now()-interval '1 day'),
 ('9a500000-0000-4000-8000-000000000002','${courseId}','Placement Tuesday','canonical-placement-tuesday','ACTIVE',now()-interval '1 day') on conflict(id) do nothing;
 insert into public.cohort_placement_settings(cohort_id,schedule) values
 ('9a500000-0000-4000-8000-000000000001','[{"weekday":1,"startMinute":1140,"endMinute":1200}]'),
 ('9a500000-0000-4000-8000-000000000002','[{"weekday":2,"startMinute":1140,"endMinute":1200}]') on conflict(cohort_id) do nothing;`);
function placementActor(userId, sql, aal = "aal1") {
  return `set role authenticated;select set_config('request.jwt.claim.sub','${userId}',false);select set_config('request.jwt.claims','{"sub":"${userId}","aal":"${aal}"}',false);${sql};`;
}
for (const [index, student] of placementUsers.entries()) {
  runAdmin(`insert into public.user_roles(user_id,role) values('${student.id}','STUDENT') on conflict do nothing;
 insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status) values('${student.id}','10000000-0000-0000-0000-000000000001','test','canonical-placement-${index}','ACTIVE') on conflict(provider,provider_subscription_id) do update set status='ACTIVE',ended_at=null,current_period_end=null;
 insert into public.teacher_student_assignments(teacher_id,student_user_id) select '${teacherId}','${student.id}' where not exists(select 1 from public.teacher_student_assignments where teacher_id='${teacherId}' and student_user_id='${student.id}' and ends_at is null);`);
  if (index === 0) continue;
  runAdmin(
    placementActor(
      student.id,
      "select public.begin_placement();select public.save_placement_preferences('America/Recife',1,1080,1260);select public.start_placement_assessment()",
    ),
  );
  const attempt = runAdmin(
    `select assessment_attempt_id from public.placement_cases where user_id='${student.id}'`,
  );
  runAdmin(
    placementActor(
      student.id,
      `select public.record_assessment_response('${attempt}','${placementObjectiveId}','{"optionId":"a"}')`,
    ),
  );
  if (index === 1) continue;
  runAdmin(
    placementActor(
      student.id,
      `select public.record_assessment_response('${attempt}','${placementManualId}','{"text":"I study English every evening."}');select public.complete_assessment_attempt('${attempt}')`,
    ),
  );
  if (index === 3) {
    const c = runAdmin(`select id from public.placement_cases where user_id='${student.id}'`);
    runAdmin(
      placementActor(
        teacherUser.id,
        `select public.finalize_placement_review('${c}','${courseId}','Continue with Foundations and regular practice.','HIGH')`,
        "aal2",
      ),
    );
  }
}
console.log("Placement fixtures ready: initial, resume, review pending and placement ready.");
