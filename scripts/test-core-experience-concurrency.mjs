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
function asStudent(sql) {
  return `set role authenticated; select set_config('request.jwt.claim.sub','${student}',false); select set_config('request.jwt.claims','{"sub":"${student}","aal":"aal1"}',false); ${sql};`;
}
runAdmin(`
 insert into auth.users(id) values('${student}'),('${teacherUser}');
 insert into public.user_roles(user_id,role) values('${student}','STUDENT'),('${teacherUser}','TEACHER'),('${teacherUser}','ADMIN');
 insert into public.teachers(id,user_id) values('${teacher}','${teacherUser}');
 insert into public.enrollments(id,user_id,course_id,status) values('${enrollment}','${student}','40000000-0000-4000-8000-000000000001','ACTIVE');
 insert into public.cohorts(id,course_id,name,code,status,starts_at) values('${cohort}','40000000-0000-4000-8000-000000000001','Core race','${cohort}','ACTIVE',now()-interval '1 day');
 insert into public.cohort_teachers(cohort_id,teacher_id) values('${cohort}','${teacher}');
 insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values('${cohort}','${student}','${enrollment}');
 insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status)
 values('${student}','10000000-0000-0000-0000-000000000001','test','core-race-${student}','ACTIVE');
 insert into public.practice_activities(id,slug,title,skill,estimated_minutes,content) values('${activity}','${activity}','Review race','SPEAKING',2,'{"kind":"MANUAL_TEXT","prompt":"Explain a daily routine","responseLabel":"Response","minLength":1,"maxLength":2000}');
`);
runAdmin(
  asTeacher(
    `select public.manage_teacher_availability(
      'CREATE',
      null,
      date_trunc('day',now())+interval '20 days 10 hours',
      date_trunc('day',now())+interval '20 days 14 hours'
    )`,
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

// Session edit × booking: either the edit commits first and the booking snapshots the
// new schedule, or the booking commits first and freezes structural fields.
runAdmin(
  asTeacher(
    `select public.manage_teacher_availability(
      'CREATE',
      null,
      date_trunc('day',now())+interval '22 days 10 hours',
      date_trunc('day',now())+interval '22 days 16 hours'
    )`,
  ),
);
const editSession = runAdmin(
  asTeacher(
    `select public.manage_teacher_session(
      null,
      jsonb_build_object(
        'title','Edit booking race',
        'session_type','CORE_CLASS',
        'starts_at',date_trunc('day',now())+interval '22 days 12 hours',
        'ends_at',date_trunc('day',now())+interval '22 days 13 hours',
        'capacity',6,
        'cohort_id','${cohort}'
      )
    )`,
  ),
);
const editInput = `jsonb_build_object(
  'title','Edit booking race',
  'starts_at',date_trunc('day',now())+interval '22 days 13 hours',
  'ends_at',date_trunc('day',now())+interval '22 days 14 hours',
  'capacity',6,
  'cohort_id','${cohort}'
)`;
const editBookingRace = await withBarrier(
  `select id from public.live_sessions where id='${editSession}' for update`,
  [
    asTeacher(`select public.manage_teacher_session('${editSession}',${editInput})`),
    asStudent(`select public.book_live_session_result('${editSession}')`),
  ],
);
if (editBookingRace[1]?.code !== 0)
  throw new Error("Concurrent booking lost the session edit race unexpectedly");
if (
  editBookingRace[0]?.code !== 0 &&
  !editBookingRace[0]?.stderr.includes("immutable")
)
  throw new Error("Concurrent session edit failed for an unexpected reason");
if (
  runAdmin(
    `select count(*) from public.session_bookings b
     join public.live_sessions s on s.id=b.live_session_id
     where b.live_session_id='${editSession}'
       and b.user_id='${student}'
       and b.status='BOOKED'
       and b.usage_session_starts_at is distinct from s.starts_at`,
  ) !== "0"
)
  throw new Error("Session edit × booking produced an incompatible usage snapshot");
console.log(
  "✓ Session edit × booking: booking snapshot always matches the committed session structure.",
);

// Availability delete × session creation: Teacher-row serialization allows exactly one
// structural outcome and never leaves a scheduled session outside valid availability.
const raceAvailability = runAdmin(
  asTeacher(
    `select public.manage_teacher_availability(
      'CREATE',
      null,
      date_trunc('day',now())+interval '24 days 10 hours',
      date_trunc('day',now())+interval '24 days 16 hours'
    )`,
  ),
);
const availabilitySessionInput = `jsonb_build_object(
  'title','Availability race',
  'session_type','CORE_CLASS',
  'starts_at',date_trunc('day',now())+interval '24 days 12 hours',
  'ends_at',date_trunc('day',now())+interval '24 days 13 hours',
  'capacity',6,
  'cohort_id','${cohort}'
)`;
const availabilityRace = await withBarrier(
  `select id from public.teachers where id='${teacher}' for update`,
  [
    asTeacher(
      `select public.manage_teacher_availability('DELETE','${raceAvailability}',null,null)`,
    ),
    asTeacher(`select public.manage_teacher_session(null,${availabilitySessionInput})`),
  ],
);
if (availabilityRace.filter((item) => item.code === 0).length !== 1)
  throw new Error("Availability delete × session creation did not serialize to one winner");
if (
  !availabilityRace.some(
    (item) =>
      item.stderr.includes("scheduled dependencies") ||
      item.stderr.includes("Availability required"),
  )
)
  throw new Error("Availability race loser did not fail on the expected invariant");
if (
  runAdmin(
    `select count(*) from public.live_sessions s
     where s.title='Availability race'
       and s.status='SCHEDULED'
       and not exists (
         select 1 from public.teacher_availability a
         where a.teacher_id=s.teacher_id
           and a.starts_at<=s.starts_at
           and a.ends_at>=s.ends_at
       )`,
  ) !== "0"
)
  throw new Error("Availability race left a scheduled session outside valid availability");
console.log(
  "✓ Availability delete × session creation: serialized result never violates availability.",
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
