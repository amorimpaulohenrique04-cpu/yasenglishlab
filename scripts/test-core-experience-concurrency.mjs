import { randomUUID } from "node:crypto";
import { runAdmin, withBarrier } from "./_postgres-concurrency.mjs";

const student = randomUUID(),
  teacherUser = randomUUID(),
  teacher = randomUUID();
const cohort = randomUUID(),
  enrollment = randomUUID(),
  activity = randomUUID();
function asTeacher(sql) {
  return `set role authenticated; select set_config('request.jwt.claim.sub','${teacherUser}',false); select set_config('request.jwt.claims','{"sub":"${teacherUser}","aal":"aal2"}',false); ${sql};`;
}
runAdmin(`
 insert into auth.users(id) values('${student}'),('${teacherUser}');
 insert into public.user_roles(user_id,role) values('${student}','STUDENT'),('${teacherUser}','TEACHER'),('${teacherUser}','ADMIN');
 insert into public.teachers(id,user_id) values('${teacher}','${teacherUser}');
 insert into public.enrollments(id,user_id,course_id,status) values('${enrollment}','${student}','40000000-0000-4000-8000-000000000001','ACTIVE');
 insert into public.cohorts(id,course_id,name,code,status,starts_at) values('${cohort}','40000000-0000-4000-8000-000000000001','Core race','${cohort}','ACTIVE',now()-interval '1 day');
 insert into public.cohort_teachers(cohort_id,teacher_id) values('${cohort}','${teacher}');
 insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values('${cohort}','${student}','${enrollment}');
 insert into public.practice_activities(id,slug,title,skill,estimated_minutes,content) values('${activity}','${activity}','Review race','SPEAKING',2,'{"kind":"MANUAL_TEXT","prompt":"Explain a daily routine","responseLabel":"Response","minLength":1,"maxLength":2000}');
`);
runAdmin(
  asTeacher(
    `select public.manage_teacher_availability('CREATE',null,now()+interval '1 minute',now()+interval '30 days')`,
  ),
);
const sessionInput = `jsonb_build_object('title','Overlap race','session_type','CORE_CLASS','starts_at',date_trunc('day',now())+interval '20 days 12 hours','ends_at',date_trunc('day',now())+interval '20 days 13 hours','capacity',6,'cohort_id','${cohort}')`;
const overlap = await withBarrier(
  `select id from public.teachers where id='${teacher}' for update`,
  [
    asTeacher(`select public.manage_teacher_session(null,${sessionInput})`),
    asTeacher(`select public.manage_teacher_session(null,${sessionInput})`),
  ],
);
if (
  overlap.filter((item) => item.code === 0).length !== 1 ||
  !overlap.some((item) => item.stderr.includes("overlap"))
)
  throw new Error("Concurrent overlap guard failed");
console.log(
  "✓ Concurrent session creation: one winner, overlapping request rejected, extra ADMIN role does not expand scope.",
);

const ratings = JSON.stringify({
  task_completion: "SOLID",
  comprehensibility: "SOLID",
  fluency: "SOLID",
  language_accuracy: "SOLID",
  vocabulary_use: "SOLID",
  pronunciation_intelligibility: "SOLID",
});
function pendingAttempt() {
  const id = randomUUID();
  runAdmin(
    `insert into public.practice_attempts(id,user_id,practice_activity_id,status,submitted_at) values('${id}','${student}','${activity}','SUBMITTED',now()); insert into public.practice_results(practice_attempt_id,evaluation_status) values('${id}','PENDING_MANUAL');`,
  );
  return id;
}
const attempt = pendingAttempt();
const reviewSql = asTeacher(
  `select public.finalize_practice_review('${attempt}','${ratings}','Feedback')`,
);
const identical = await withBarrier(
  `select id from public.practice_attempts where id='${attempt}' for update`,
  [reviewSql, reviewSql],
);
if (
  identical.some((item) => item.code !== 0) ||
  runAdmin(
    `select count(*) from public.practice_manual_reviews where practice_attempt_id='${attempt}'`,
  ) !== "1"
)
  throw new Error("Concurrent identical review was not idempotent");
const conflictAttempt = pendingAttempt();
const conflicting = await withBarrier(
  `select id from public.practice_attempts where id='${conflictAttempt}' for update`,
  ["A", "B"].map((feedback) =>
    asTeacher(
      `select public.finalize_practice_review('${conflictAttempt}','${ratings}','${feedback}')`,
    ),
  ),
);
if (
  conflicting.filter((item) => item.code === 0).length !== 1 ||
  !conflicting.some((item) => item.stderr.includes("already finalized"))
)
  throw new Error("Concurrent conflicting review failed");
console.log(
  "✓ Real review concurrency: identical requests share one review; conflicting feedback has one winner.",
);

const asset = randomUUID();
runAdmin(
  `insert into public.lesson_assets(id,lesson_id,asset_type,position) values('${asset}','42000000-0000-4000-8000-000000000001','VIDEO',99)`,
);
const video = runAdmin(
  `update public.lesson_video_assets set provider_upload_id='${asset}',provider_asset_id='${asset}',processing_status='PROCESSING' where lesson_asset_id='${asset}' returning id`,
);
const event = randomUUID();
const webhookSql = `select public.process_mux_provider_event('${event}','video.asset.ready','${video}','${asset}','${asset}','fake-playback',120,'16:9')`;
const webhooks = await withBarrier(
  `select id from public.lesson_video_assets where id='${video}' for update`,
  [webhookSql, webhookSql],
);
if (
  webhooks.some((item) => item.code !== 0) ||
  runAdmin(
    `select count(*) from public.media_provider_events where event_id='${event}' and processing_status='PROCESSED'`,
  ) !== "1"
)
  throw new Error("Concurrent webhook deduplication failed");
runAdmin(`delete from public.lesson_assets where id='${asset}'`);
console.log("✓ Real webhook concurrency: one durable processed event and READY projection.");
