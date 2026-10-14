import { randomUUID } from "node:crypto";
import { runAdmin, withBarrier } from "./_postgres-concurrency.mjs";

// ADR 0018: two concurrent completions of the last two lessons must flip the enrollment to COMPLETED
// exactly once, without deadlock (the trigger locks the enrollment FOR NO KEY UPDATE and re-counts).
const student = randomUUID(),
  course = randomUUID(),
  moduleId = randomUUID(),
  lessons = [randomUUID(), randomUUID()],
  assets = [randomUUID(), randomUUID()],
  cohort = randomUUID(),
  enrollment = randomUUID();

function actor(user, sql) {
  return `set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);select set_config('request.jwt.claims','{"sub":"${user}","aal":"aal1"}',false);${sql};`;
}
function scalar(sql) {
  return runAdmin(sql).split(/\r?\n/).filter(Boolean).at(-1);
}

runAdmin(`insert into auth.users(id) values('${student}');
insert into public.user_roles(user_id,role) values('${student}','STUDENT');
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status) values('${student}','10000000-0000-0000-0000-000000000001','test','completion-${student}','ACTIVE');
insert into public.courses(id,slug,title,active,publication_status,published_at) values('${course}','completion-${course}','Completion race',true,'PUBLISHED',now());
insert into public.modules(id,course_id,position,title,publication_status,published_at) values('${moduleId}','${course}',1,'Race module','PUBLISHED',now());
insert into public.lessons(id,module_id,position,slug,title,publication_status,published_at) values
  ('${lessons[0]}','${moduleId}',1,'race-1-${lessons[0]}','Race 1','DRAFT',null),
  ('${lessons[1]}','${moduleId}',2,'race-2-${lessons[1]}','Race 2','DRAFT',null);
insert into public.lesson_assets(id,lesson_id,asset_type,position,content,publication_status,published_at) values
  ('${assets[0]}','${lessons[0]}','TEXT',1,'{"title":"R1","body":"Race body 1"}','PUBLISHED',now()),
  ('${assets[1]}','${lessons[1]}','TEXT',1,'{"title":"R2","body":"Race body 2"}','PUBLISHED',now());
update public.lessons set publication_status='PUBLISHED',published_at=now() where id in ('${lessons[0]}','${lessons[1]}');
insert into public.enrollments(id,user_id,course_id,status) values('${enrollment}','${student}','${course}','ACTIVE');
insert into public.cohorts(id,course_id,name,code,status,starts_at) values('${cohort}','${course}','Completion race','${cohort}','ACTIVE',now()-interval '1 day');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values('${cohort}','${student}','${enrollment}');`);

const operations = lessons.map((lesson) =>
  actor(student, `select public.record_lesson_progress('${lesson}',100,0)`),
);
const result = await withBarrier(
  `select id from public.enrollments where id='${enrollment}' for update`,
  operations,
);
if (result.some((r) => r.code !== 0))
  throw new Error(`Concurrent final lessons failed: ${JSON.stringify(result)}`);
if (
  scalar(
    `select status || ':' || (completed_at is not null) from public.enrollments where id='${enrollment}'`,
  ) !== "COMPLETED:true"
)
  throw new Error("Enrollment was not completed after both final lessons committed");
if (
  scalar(
    `select count(*) from public.audit_logs where action='enrollment_course_completed' and entity_id='${enrollment}'`,
  ) !== "1"
)
  throw new Error("Completion was recorded more than once");

// Re-recording a lesson after completion keeps the COMPLETED state and writes no second completion.
runAdmin(actor(student, `select public.record_lesson_progress('${lessons[0]}',100,0)`));
if (
  scalar(
    `select count(*) from public.audit_logs where action='enrollment_course_completed' and entity_id='${enrollment}'`,
  ) !== "1"
)
  throw new Error("Repeated progress after completion re-completed the enrollment");

console.log(
  "PASS Course completion real concurrency: two final lessons in parallel, no deadlock, exactly one COMPLETED and one audit row; progress after completion still allowed.",
);
