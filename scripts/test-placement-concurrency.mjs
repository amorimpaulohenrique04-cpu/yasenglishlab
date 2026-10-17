import { randomUUID } from "node:crypto";
import { runAdmin, withBarrier } from "./_postgres-concurrency.mjs";
const students = [randomUUID(), randomUUID()],
  teacherUser = randomUUID(),
  teacher = randomUUID(),
  cohort = randomUUID(),
  assessment = randomUUID(),
  version = randomUUID(),
  item = randomUUID();
const course = "40000000-0000-4000-8000-000000000001";
function actor(user, sql, aal = "aal1") {
  return `set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);select set_config('request.jwt.claims','{"sub":"${user}","aal":"${aal}"}',false);${sql};`;
}
function scalar(sql) {
  return runAdmin(sql).split(/\r?\n/).filter(Boolean).at(-1);
}
// The entry assessment is explicit and unique (ADR 0021): remember the current one, take over, restore at the end.
const uuidLine = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const previousPlacement = runAdmin(
  "update public.assessments set is_placement=false where is_placement and active returning id",
)
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => uuidLine.test(line));
runAdmin(`insert into auth.users(id) values('${students[0]}'),('${students[1]}'),('${teacherUser}');
insert into public.user_roles(user_id,role) values('${students[0]}','STUDENT'),('${students[1]}','STUDENT'),('${teacherUser}','TEACHER'),('${teacherUser}','ADMIN');
insert into public.teachers(id,user_id) values('${teacher}','${teacherUser}');
insert into public.teacher_student_assignments(teacher_id,student_user_id) values('${teacher}','${students[0]}'),('${teacher}','${students[1]}');
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status) values('${students[0]}','10000000-0000-0000-0000-000000000001','test','${students[0]}','ACTIVE'),('${students[1]}','10000000-0000-0000-0000-000000000001','test','${students[1]}','ACTIVE');
insert into public.cohorts(id,course_id,name,code,status,starts_at) values('${cohort}','${course}','Last seat','${cohort}','ACTIVE',now()-interval '1 day');
insert into public.cohort_placement_settings(cohort_id,schedule) values('${cohort}','[{"weekday":1,"startMinute":1140,"endMinute":1200}]');
insert into public.assessments(id,slug,title,purpose,is_placement) values('${assessment}','${assessment}','Race fixture','Synthetic',true);
insert into public.assessment_versions(id,assessment_id,version_number,status,specification,scoring_config) values('${version}','${assessment}',1,'DRAFT','{}','{}');
insert into public.assessment_items(id,assessment_version_id,position,skill,item_type,prompt,answer_key) values('${item}','${version}',1,'GRAMMAR','MULTIPLE_CHOICE','{"prompt":"Choose","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}','{"optionId":"a"}');
update public.assessment_versions set status='PUBLISHED',published_at=now()+interval '2 hours' where id='${version}';`);
const cases = [];
for (const student of students) {
  const c = scalar(actor(student, "select public.begin_placement()"));
  cases.push(c);
  runAdmin(
    actor(student, "select public.save_placement_preferences('America/Recife',1,1080,1260)"),
  );
  const attempt = scalar(actor(student, "select public.start_placement_assessment()"));
  runAdmin(
    actor(
      student,
      `select public.record_assessment_response('${attempt}','${item}','{"optionId":"a"}');select public.complete_assessment_attempt('${attempt}')`,
    ),
  );
  const review = actor(
    teacherUser,
    `select public.finalize_placement_review('${c}','${course}','Evidence based track','HIGH')`,
    "aal2",
  );
  const same = await withBarrier(
    `select id from public.placement_cases where id='${c}' for update`,
    [review, review],
  );
  if (
    same.some((r) => r.code !== 0) ||
    same[0].stdout.split(/\r?\n/).filter(Boolean).at(-1) !==
      same[1].stdout.split(/\r?\n/).filter(Boolean).at(-1)
  )
    throw new Error("Concurrent identical review retry failed");
  runAdmin(actor(student, "select public.open_placement_decision()"));
}
const operations = students.map((s) =>
  actor(s, `select public.confirm_placement_choice('${cohort}')`),
);
const result = await withBarrier(
  `select id from public.cohorts where id='${cohort}' for update`,
  operations,
);
// Cohorts have no student ceiling: both concurrent confirmations must succeed, once each.
if (result.some((r) => r.code !== 0))
  throw new Error(`Concurrent confirmations failed: ${JSON.stringify(result)}`);
const winner = 0;
const retry = await withBarrier(
  `select id from public.placement_cases where id='${cases[winner]}' for update`,
  [operations[winner], operations[winner]],
);
if (retry.some((r) => r.code !== 0)) throw new Error("Concurrent identical choice retry failed");
if (
  scalar(
    `select count(*) from public.cohort_memberships where cohort_id='${cohort}' and status='ACTIVE'`,
  ) !== "2"
)
  throw new Error("Missing or duplicate membership");
if (
  scalar(
    `select count(*) from public.placement_decisions where placement_case_id in ('${cases[0]}','${cases[1]}')`,
  ) !== "2"
)
  throw new Error("Each confirming student must have exactly one decision");
if (
  scalar(
    `select count(*) from public.enrollments where user_id in ('${students[0]}','${students[1]}')`,
  ) !== "2"
)
  throw new Error("Each confirming student must have exactly one enrollment");
console.log(
  "PASS Placement real concurrency: two eligible Students confirm the same cohort concurrently, both succeed once; identical review/choice retries stable; occupancy=2.",
);

// Retain evidence rows while excluding this synthetic version from later UI discovery.
runAdmin(`update public.assessments set active=false,is_placement=false where id='${assessment}'`);
for (const id of previousPlacement)
  runAdmin(`update public.assessments set is_placement=true where id='${id}'`);
