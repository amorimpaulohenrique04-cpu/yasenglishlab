#!/usr/bin/env node
// Dados fictícios para validação humana no Supabase LOCAL (nunca em produção).
//
// Cria/atualiza três logins de desenvolvimento (aluno, professor, admin), alunos
// fictícios e dados em todas as abas: turmas, matrículas, assinaturas, agenda,
// disponibilidade, progresso, práticas (com revisão pendente e revisada), teste de
// entrada, leads, suporte, ocorrências e conciliação.
//
// Os fluxos do aluno passam pelas mesmas RPCs da aplicação (login real), e as ações
// de professor/admin com AAL2 passam por SQL com claims explícitos, como em
// scripts/setup-canonical-e2e.mjs. Idempotente: pode ser executado várias vezes.
// IDs próprios (prefixo "de") não colidem com os fixtures canônicos de e2e.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const databaseUrl = process.env.DATABASE_URL;

const local = /^(https?:\/\/|postgres(ql)?:\/\/[^@]*@)(127\.0\.0\.1|localhost)[:/]/;
if (!url || !serviceRoleKey || !anonKey || !databaseUrl) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL, chaves e DATABASE_URL em .env.local.");
}
if (!local.test(url) || !local.test(databaseUrl)) {
  throw new Error("dev-seed só roda contra o Supabase local (127.0.0.1/localhost).");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------- helpers

const warnings = [];
async function step(label, run) {
  try {
    await run();
  } catch (error) {
    const message = error?.message ?? String(error);
    warnings.push(`${label}: ${message}`);
    console.warn(`  ! ${label}: ${message}`);
  }
}

function must({ data, error }, label) {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function sql(text) {
  // SQL via stdin: argumentos de linha de comando no Windows perdem a acentuação.
  const options = {
    input: text,
    encoding: "utf8",
    env: { ...process.env, PGCLIENTENCODING: "UTF8" },
  };
  const psqlArgs = ["-X", "-v", "ON_ERROR_STOP=1", "-Atq", "-f", "-"];
  let result = spawnSync("psql", [`--dbname=${databaseUrl}`, ...psqlArgs], options);
  if (result.error?.code === "ENOENT") {
    // Sem psql local: usa o psql do container do Supabase deste projeto.
    const projectId = /project_id\s*=\s*"([^"]+)"/.exec(
      readFileSync("supabase/config.toml", "utf8"),
    )?.[1];
    result = spawnSync(
      "docker",
      [
        "exec",
        "-i",
        `supabase_db_${projectId}`,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        ...psqlArgs,
      ],
      options,
    );
  }
  if (result.error) throw new Error(`psql indisponível: ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || "psql falhou").trim());
  return result.stdout.replaceAll(String.fromCharCode(13), "").trim();
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

/** Executa SQL como um usuário autenticado (claims explícitos; AAL2 para staff). */
function sqlAs(userId, body, aal = "aal2") {
  const claims = JSON.stringify({ sub: userId, role: "authenticated", aal });
  return sql(`begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub', ${quote(userId)}, true);
    select set_config('request.jwt.claims', ${quote(claims)}, true);
    ${body};
    commit;`);
}

/** UUID v4 válido e determinístico do namespace do seed: deGG0000-0000-4000-8000-NNNNNNNNNNNN. */
const id = (group, n) => `de${group}0000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Recife não tem horário de verão: UTC-3 fixo.
function at(dayOffset, hour, minute = 0) {
  const now = new Date();
  const recife = new Date(now.getTime() - 3 * 3600_000);
  const date = Date.UTC(
    recife.getUTCFullYear(),
    recife.getUTCMonth(),
    recife.getUTCDate() + dayOffset,
    hour + 3,
    minute,
  );
  return new Date(date);
}
const plusMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60_000);
const iso = (date) => date.toISOString();

async function signIn(email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login de ${email} falhou: ${error.message}`);
  return client;
}

async function rpc(client, name, args, { ignore = [] } = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (ignore.some((pattern) => pattern.test(error.message))) return null;
    throw new Error(`${name}: ${error.message}`);
  }
  return data;
}

// ---------------------------------------------------------------- dados base

const COURSE = "40000000-0000-4000-8000-000000000001";
const LESSONS = [
  "42000000-0000-4000-8000-000000000001",
  "42000000-0000-4000-8000-000000000002",
  "42000000-0000-4000-8000-000000000003",
];
const PLANS = {
  START: "10000000-0000-0000-0000-000000000001",
  TALK: "10000000-0000-0000-0000-000000000002",
  BOOST: "10000000-0000-0000-0000-000000000003",
};
const PRACTICE = {
  vocabulary: "83000000-0000-4000-8000-000000000001",
  presentSimple: "83000000-0000-4000-8000-000000000002",
  introduction: "83000000-0000-4000-8000-000000000003",
  wordStress: "83000000-0000-4000-8000-000000000004",
};
const MATERIALS = ["81710000-0000-4000-8000-000000000001", "81710000-0000-4000-8000-000000000002"];

const DEV = {
  student: {
    email: "student.dev@example.test",
    password: process.env.DEV_STUDENT_PASSWORD ?? "YasStudent123!",
    name: "Marina Costa",
    role: "STUDENT",
  },
  teacher: {
    email: "teacher.dev@example.test",
    password: process.env.DEV_TEACHER_PASSWORD ?? "YasTeacher123!",
    name: "Yasminn",
    role: "TEACHER",
  },
  admin: {
    email: "admin.dev@example.test",
    password: process.env.DEV_ADMIN_PASSWORD ?? "YasAdmin123!",
    name: "Admin Yas",
    role: "ADMIN",
  },
};

// Alunos fictícios: senha aleatória a cada execução (não são logins de uso humano).
const EXTRA = [
  { key: "lucas", name: "Lucas Almeida", plan: "TALK", status: "ACTIVE", cohort: 1 },
  { key: "beatriz", name: "Beatriz Rocha", plan: "BOOST", status: "ACTIVE", cohort: 1 },
  { key: "rafael", name: "Rafael Nunes", plan: "START", status: "PAST_DUE", cohort: 1 },
  { key: "camila", name: "Camila Ferreira", plan: "TALK", status: "TRIALING", cohort: 2 },
  { key: "thiago", name: "Thiago Ramos", plan: "BOOST", status: "ACTIVE", cohort: 2 },
  { key: "juliana", name: "Juliana Prado", plan: "START", status: "CANCELLED", cohort: null },
];
const PLACEMENT = [
  { key: "helena", name: "Helena Duarte", plan: "TALK", stage: "REVIEW_PENDING" },
  { key: "gustavo", name: "Gustavo Lima", plan: "BOOST", stage: "PLACEMENT_READY" },
  { key: "sofia", name: "Sofia Mendes", plan: "START", stage: "IN_PROGRESS" },
];
for (const person of [...EXTRA, ...PLACEMENT]) {
  person.email = `${person.key}.dev@example.test`;
  person.password = randomBytes(18).toString("base64url");
  person.role = "STUDENT";
}

const COHORTS = [
  {
    id: id("20", 1),
    name: "Foundations · Seg e Qua 19h",
    code: "dev-foundations-noite",
    status: "ACTIVE",
    schedule: [
      { weekday: 1, startMinute: 1140, endMinute: 1200 },
      { weekday: 3, startMinute: 1140, endMinute: 1200 },
    ],
  },
  {
    id: id("20", 2),
    name: "Foundations · Sábado 9h",
    code: "dev-foundations-sabado",
    status: "ACTIVE",
    schedule: [{ weekday: 6, startMinute: 540, endMinute: 600 }],
  },
  {
    id: id("20", 3),
    name: "Foundations · Turma de novembro",
    code: "dev-foundations-novembro",
    status: "PLANNED",
    schedule: [{ weekday: 2, startMinute: 1200, endMinute: 1260 }],
  },
];
const TEACHER_ID = id("10", 1);

// ---------------------------------------------------------------- usuários

console.log("1/8 Usuários e papéis");
const listed = must(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), "listUsers");

async function ensureUser(person) {
  const existing = listed.users.find((user) => user.email === person.email);
  const attributes = {
    password: person.password,
    email_confirm: true,
    user_metadata: { display_name: person.name },
  };
  const result = existing
    ? await admin.auth.admin.updateUserById(existing.id, attributes)
    : await admin.auth.admin.createUser({ email: person.email, ...attributes });
  const user = must(result, `usuário ${person.email}`).user;
  person.id = user.id;
  must(
    await admin
      .from("profiles")
      .upsert({ user_id: user.id, display_name: person.name }, { onConflict: "user_id" }),
    `perfil ${person.email}`,
  );
  must(
    await admin
      .from("user_roles")
      .upsert({ user_id: user.id, role: person.role }, { onConflict: "user_id,role" }),
    `papel ${person.email}`,
  );
}

for (const person of [...Object.values(DEV), ...EXTRA, ...PLACEMENT]) await ensureUser(person);

// ---------------------------------------------------------------- catálogo, professor, turmas

console.log("2/8 Catálogo, professor e turmas");
for (const [table, ids] of [
  ["courses", [COURSE]],
  ["lessons", LESSONS],
  ["practice_activities", Object.values(PRACTICE)],
  ["materials", MATERIALS],
]) {
  await step(`publicar ${table}`, async () => {
    must(
      await admin
        .from(table)
        .update({ publication_status: "PUBLISHED", published_at: "2026-10-01T00:00:00Z" })
        .in("id", ids)
        .neq("publication_status", "PUBLISHED"),
      table,
    );
  });
}

const existingTeacher = must(
  await admin.from("teachers").select("id").eq("user_id", DEV.teacher.id).maybeSingle(),
  "professor",
);
const teacherId = existingTeacher?.id ?? TEACHER_ID;
if (!existingTeacher) {
  must(
    await admin.from("teachers").insert({
      id: teacherId,
      user_id: DEV.teacher.id,
      active: true,
      bio: "Professora de inglês com foco em conversação e confiança para falar.",
    }),
    "professor",
  );
}
await step("curso do professor", async () => {
  must(
    await admin
      .from("teacher_courses")
      .upsert(
        { teacher_id: teacherId, course_id: COURSE, created_by_user_id: DEV.admin.id },
        { onConflict: "teacher_id,course_id" },
      ),
    "teacher_courses",
  );
});

for (const cohort of COHORTS) {
  must(
    await admin.from("cohorts").upsert(
      {
        id: cohort.id,
        course_id: COURSE,
        name: cohort.name,
        code: cohort.code,
        status: cohort.status,
        timezone: "America/Recife",
        starts_at: cohort.status === "PLANNED" ? iso(at(20, 0)) : "2026-09-01T00:00:00-03:00",
      },
      { onConflict: "id" },
    ),
    `turma ${cohort.code}`,
  );
  await step(`horário da turma ${cohort.code}`, async () => {
    must(
      await admin
        .from("cohort_placement_settings")
        .upsert({ cohort_id: cohort.id, schedule: cohort.schedule }, { onConflict: "cohort_id" }),
      "cohort_placement_settings",
    );
  });
  await step(`professor da turma ${cohort.code}`, async () => {
    const active = must(
      await admin
        .from("cohort_teachers")
        .select("id")
        .eq("cohort_id", cohort.id)
        .eq("teacher_id", teacherId)
        .is("ends_at", null)
        .maybeSingle(),
      "cohort_teachers",
    );
    if (!active) {
      must(
        await admin
          .from("cohort_teachers")
          .insert({ cohort_id: cohort.id, teacher_id: teacherId, is_primary: true }),
        "cohort_teachers",
      );
    }
  });
}

// ---------------------------------------------------------------- matrículas e assinaturas

console.log("3/8 Matrículas, assinaturas e turmas dos alunos");
const studentPlans = [
  { person: DEV.student, plan: "BOOST", status: "ACTIVE", cohort: 1 },
  ...EXTRA.map((person) => ({
    person,
    plan: person.plan,
    status: person.status,
    cohort: person.cohort,
  })),
  ...PLACEMENT.map((person) => ({ person, plan: person.plan, status: "ACTIVE", cohort: null })),
];
const subscriptionIds = {};

for (const { person, plan, status, cohort } of studentPlans) {
  await step(`assinatura ${person.email}`, async () => {
    const cancelled = status === "CANCELLED";
    const data = must(
      await admin
        .from("subscriptions")
        .upsert(
          {
            user_id: person.id,
            plan_id: PLANS[plan],
            provider: "dev-seed",
            provider_customer_id: `cus_dev_${person.key ?? "marina"}`,
            provider_subscription_id: `sub_dev_${person.key ?? "marina"}`,
            status,
            current_period_start: iso(at(-12, 0)),
            current_period_end: cancelled ? iso(at(-2, 0)) : iso(at(18, 0)),
            started_at: iso(at(-42, 0)),
            ended_at: cancelled ? iso(at(-2, 0)) : null,
            cancel_at_period_end: false,
          },
          { onConflict: "provider,provider_subscription_id" },
        )
        .select("id")
        .single(),
      "subscriptions",
    );
    subscriptionIds[person.email] = data.id;
  });

  // Alunos do teste de entrada ainda não têm turma nem matrícula: o fluxo cria.
  if (PLACEMENT.includes(person)) continue;

  await step(`matrícula ${person.email}`, async () => {
    const enrollment = must(
      await admin
        .from("enrollments")
        .upsert(
          { user_id: person.id, course_id: COURSE, status: "ACTIVE" },
          { onConflict: "user_id,course_id" },
        )
        .select("id")
        .single(),
      "enrollments",
    );
    person.enrollmentId = enrollment.id;
    if (!cohort) return;
    const cohortId = COHORTS[cohort - 1].id;
    const active = must(
      await admin
        .from("cohort_memberships")
        .select("id")
        .eq("user_id", person.id)
        .eq("status", "ACTIVE")
        .maybeSingle(),
      "cohort_memberships",
    );
    if (!active) {
      must(
        await admin
          .from("cohort_memberships")
          .insert({ cohort_id: cohortId, user_id: person.id, enrollment_id: enrollment.id }),
        "cohort_memberships",
      );
    }
  });

  await step(`vínculo professor ${person.email}`, async () => {
    sql(`insert into public.teacher_student_assignments(teacher_id, student_user_id, course_id, created_by_user_id)
      select ${quote(teacherId)}, ${quote(person.id)}, ${quote(COURSE)}, ${quote(DEV.admin.id)}
      where not exists (select 1 from public.teacher_student_assignments
        where teacher_id = ${quote(teacherId)} and student_user_id = ${quote(person.id)} and ends_at is null)`);
  });
}

await step("cortesia (Juliana)", async () => {
  const juliana = EXTRA.find((person) => person.key === "juliana");
  must(
    await admin.from("complimentary_access_grants").upsert(
      {
        user_id: juliana.id,
        reason: "ADMIN_GRANT",
        note: "Cortesia de 30 dias enquanto regulariza o pagamento.",
        granted_by: DEV.admin.id,
        expires_at: iso(at(30, 0)),
        revoked_at: null,
        revoked_by: null,
      },
      { onConflict: "user_id" },
    ),
    "complimentary_access_grants",
  );
});

// ---------------------------------------------------------------- agenda

console.log("4/8 Agenda, disponibilidade e presença");
const SESSIONS = [
  {
    n: 1,
    type: "CORE_CLASS",
    title: "Foundations · Small talk no trabalho",
    start: at(1, 19),
    minutes: 60,
    capacity: 6,
    key: "weekly_core_classes",
    cohort: 1,
    bookers: ["student", "lucas", "beatriz"],
  },
  {
    n: 2,
    type: "CONVERSATION_LAB",
    title: "Conversation Lab · Planejando uma viagem",
    start: at(2, 20),
    minutes: 60,
    capacity: 4,
    key: "weekly_conversation_labs",
    bookers: ["student", "thiago"],
  },
  {
    n: 3,
    type: "CORE_CLASS",
    title: "Foundations · Rotina e hábitos",
    start: at(4, 9),
    minutes: 60,
    capacity: 6,
    key: "weekly_core_classes",
    cohort: 2,
    bookers: ["camila", "thiago"],
  },
  {
    n: 4,
    type: "PRIVATE_SESSION",
    title: "Sessão particular · Entrevista de emprego",
    start: at(5, 18),
    minutes: 45,
    capacity: 1,
    key: "monthly_private_sessions",
    target: "student",
    bookers: ["student"],
  },
  {
    n: 5,
    type: "CORE_CLASS",
    title: "Foundations · Pedindo e dando direções",
    start: at(8, 19),
    minutes: 60,
    capacity: 6,
    key: "weekly_core_classes",
    cohort: 1,
    bookers: ["lucas"],
  },
  {
    n: 6,
    type: "WORKSHOP",
    title: "Workshop · Pronúncia do TH",
    start: at(10, 18),
    minutes: 60,
    capacity: 6,
    key: null,
    bookers: ["student", "beatriz"],
  },
];
const PAST = [
  {
    n: 11,
    type: "CORE_CLASS",
    title: "Foundations · Apresentações pessoais",
    start: at(-3, 19),
    minutes: 60,
    capacity: 6,
    key: "weekly_core_classes",
    cohort: 1,
    attendance: { student: "ATTENDED", lucas: "ATTENDED", beatriz: "NO_SHOW" },
  },
  {
    n: 12,
    type: "CONVERSATION_LAB",
    title: "Conversation Lab · Comida e restaurantes",
    start: at(-6, 20),
    minutes: 60,
    capacity: 4,
    key: "weekly_conversation_labs",
    attendance: { student: "ATTENDED", thiago: "ATTENDED" },
  },
];
const personByKey = (key) => (key === "student" ? DEV.student : EXTRA.find((p) => p.key === key));
const allSessionIds = [...SESSIONS, ...PAST].map((session) => id("40", session.n));

await step("limpar agenda anterior do seed", async () => {
  const list = allSessionIds.map(quote).join(",");
  sql(`delete from public.notifications where data ->> 'live_session_id' in (${list});
       delete from public.attendance where session_booking_id in
         (select id from public.session_bookings where live_session_id in (${list}));
       delete from public.session_bookings where live_session_id in (${list});
       delete from public.live_sessions where id in (${list});
       delete from public.teacher_availability where teacher_id = ${quote(teacherId)};`);
});

await step("disponibilidade", async () => {
  const windows = [
    ...SESSIONS.map((session) => [
      plusMinutes(session.start, -60),
      plusMinutes(session.start, session.minutes + 60),
    ]),
    [at(6, 14), at(6, 17)],
    [at(7, 9), at(7, 12)],
    [at(9, 18), at(9, 21)],
    [at(12, 14), at(12, 18)],
  ];
  must(
    await admin.from("teacher_availability").insert(
      windows.map(([starts, ends]) => ({
        teacher_id: teacherId,
        starts_at: iso(starts),
        ends_at: iso(ends),
        timezone: "America/Recife",
      })),
    ),
    "teacher_availability",
  );
});

for (const session of [...SESSIONS, ...PAST]) {
  await step(`encontro "${session.title}"`, async () => {
    must(
      await admin.from("live_sessions").insert({
        id: id("40", session.n),
        teacher_id: teacherId,
        session_type: session.type,
        title: session.title,
        starts_at: iso(session.start),
        ends_at: iso(plusMinutes(session.start, session.minutes)),
        capacity: session.capacity,
        required_entitlement_key: session.key,
        status: "SCHEDULED",
        cohort_id: session.cohort ? COHORTS[session.cohort - 1].id : null,
        target_student_user_id: session.target ? personByKey(session.target).id : null,
        meeting_provider: "MANUAL_EXTERNAL",
        meeting_ref: `https://meet.google.com/dev-yas-${session.n}`,
      }),
      "live_sessions",
    );
  });
}

// Reservas futuras passam pela RPC do aluno (cotas e regras reais).
const studentClients = {};
async function clientOf(person) {
  studentClients[person.email] ??= await signIn(person.email, person.password);
  return studentClients[person.email];
}
for (const session of SESSIONS) {
  for (const key of session.bookers) {
    await step(`reserva ${key} em "${session.title}"`, async () => {
      await rpc(await clientOf(personByKey(key)), "book_live_session", {
        p_live_session_id: id("40", session.n),
      });
    });
  }
}

// Encontros passados: reserva + presença registradas pelo serviço, depois concluídos.
for (const session of PAST) {
  await step(`presença em "${session.title}"`, async () => {
    for (const [key, status] of Object.entries(session.attendance)) {
      const booking = must(
        await admin
          .from("session_bookings")
          .insert({ live_session_id: id("40", session.n), user_id: personByKey(key).id })
          .select("id")
          .single(),
        "session_bookings",
      );
      must(
        await admin.from("attendance").insert({
          session_booking_id: booking.id,
          status,
          marked_at: iso(plusMinutes(session.start, session.minutes + 5)),
          marked_by_user_id: DEV.teacher.id,
        }),
        "attendance",
      );
    }
    must(
      await admin
        .from("live_sessions")
        .update({ status: "COMPLETED" })
        .eq("id", id("40", session.n)),
      "live_sessions",
    );
  });
}

// ---------------------------------------------------------------- progresso e prática

console.log("5/8 Progresso, materiais e práticas");
const progressPlan = {
  student: [100, 45],
  lucas: [100, 100, 20],
  beatriz: [100, 60],
  thiago: [100],
  camila: [30],
};
for (const [key, percents] of Object.entries(progressPlan)) {
  const person = personByKey(key);
  await step(`progresso ${person.email}`, async () => {
    const client = await clientOf(person);
    for (const [index, percent] of percents.entries()) {
      await rpc(client, "record_lesson_progress", {
        p_lesson_id: LESSONS[index],
        p_completion_percent: percent,
        p_last_position_seconds: Math.round(percent * 6),
      });
    }
  });
}

await step("materiais favoritos (Marina)", async () => {
  must(
    await admin.from("material_favorites").upsert(
      MATERIALS.map((material) => ({ user_id: DEV.student.id, material_id: material })),
      { onConflict: "user_id,material_id" },
    ),
    "material_favorites",
  );
});

const INTRODUCTION_TEXT = {
  student:
    "Hi! My name is Marina and I live in Recife. I work as a designer and I love the beach. On weekends I like to cook with my family.",
  lucas:
    "Hello, I'm Lucas. I'm from Olinda and I study engineering. I like football and I play the guitar.",
  beatriz:
    "My name is Beatriz. I live in Boa Viagem and I am a nurse. I like to read and to walk on the beach.",
  thiago: "Hi, I am Thiago, I live in Jaboatão. I work in a bank. I like movies and video games.",
};
const attempts = {};
async function practice(key, activity, response, slot) {
  const person = personByKey(key);
  const client = await clientOf(person);
  const attempt = await rpc(client, "start_practice_attempt", {
    p_practice_activity_id: activity,
    p_idempotency_key: id("a0", slot),
  });
  const attemptId = typeof attempt === "string" ? attempt : attempt?.id;
  attempts[`${key}:${activity}`] = attemptId;
  await rpc(
    client,
    "submit_practice_attempt",
    { p_practice_attempt_id: attemptId, p_response: response },
    { ignore: [/cannot be submitted/i, /already/i] },
  );
}
const practicePlan = [
  ["student", PRACTICE.vocabulary, { optionId: "meet" }, 1],
  ["student", PRACTICE.introduction, { text: INTRODUCTION_TEXT.student }, 2],
  [
    "student",
    PRACTICE.wordStress,
    { text: "IN-tro-DUC-tion, PRE-sent, ho-TEL. I practiced the stress." },
    3,
  ],
  ["lucas", PRACTICE.vocabulary, { optionId: "meeting" }, 4],
  ["lucas", PRACTICE.introduction, { text: INTRODUCTION_TEXT.lucas }, 5],
  ["beatriz", PRACTICE.introduction, { text: INTRODUCTION_TEXT.beatriz }, 6],
  ["thiago", PRACTICE.introduction, { text: INTRODUCTION_TEXT.thiago }, 7],
];
for (const [key, activity, response, slot] of practicePlan) {
  await step(`prática ${key}`, () => practice(key, activity, response, slot));
}

// Duas revisões concluídas pela professora (geram "Feedbacks" para o aluno).
const SPEAKING_RATINGS = {
  task_completion: "SOLID",
  comprehensibility: "STRONG",
  fluency: "DEVELOPING",
  language_accuracy: "SOLID",
  vocabulary_use: "SOLID",
  pronunciation_intelligibility: "DEVELOPING",
};
const PRONUNCIATION_RATINGS = {
  intelligibility: "SOLID",
  target_sounds: "DEVELOPING",
  word_stress: "SOLID",
  sentence_stress_rhythm: "DEVELOPING",
};
for (const [key, activity, ratings, feedback] of [
  [
    "student",
    PRACTICE.introduction,
    SPEAKING_RATINGS,
    "Ótima apresentação, Marina! Frases claras e naturais. Para a próxima, tente ligar as ideias com 'and' e 'but' para soar mais fluida.",
  ],
  [
    "lucas",
    PRACTICE.introduction,
    SPEAKING_RATINGS,
    "Boa, Lucas! Cuidado com 'I am from' vs. 'I'm from' — os dois estão certos, mas o segundo soa mais natural na fala.",
  ],
]) {
  await step(`revisão ${key}`, async () => {
    const attempt = attempts[`${key}:${activity}`];
    if (!attempt) throw new Error("tentativa não criada");
    sqlAs(
      DEV.teacher.id,
      `select public.finalize_practice_review(${quote(attempt)}::uuid, ${quote(JSON.stringify(ratings))}::jsonb, ${quote(feedback)}, 'v1')`,
    );
  });
}
void PRONUNCIATION_RATINGS; // Marina (ritmo), Beatriz e Thiago ficam pendentes para a aba Revisões.

// ---------------------------------------------------------------- teste de entrada

console.log("6/8 Teste de entrada (Entrada / Matrículas)");
await step("teste de entrada", async () => {
  let version = sql(`select v.id from public.assessments a
      join public.assessment_versions v on v.assessment_id = a.id
      where a.is_placement and a.active and v.status = 'PUBLISHED'
      order by v.version_number desc limit 1`);
  if (!version) {
    const assessmentId = id("9a", 1);
    version = id("9b", 1);
    sql(`insert into public.assessments(id, slug, title, purpose, is_placement)
           values (${quote(assessmentId)}, 'dev-placement', 'Teste de entrada · Foundations',
                   'Avaliação inicial revisada por professor; não define CEFR automaticamente', true)
           on conflict (id) do update set is_placement = true, active = true;
         insert into public.assessment_versions(id, assessment_id, version_number, status, specification, scoring_config)
           values (${quote(version)}, ${quote(assessmentId)}, 1, 'DRAFT', '{}', '{}') on conflict (id) do nothing;
         do $$ begin
           if (select status from public.assessment_versions where id = ${quote(version)}) = 'DRAFT' then
             insert into public.assessment_items(id, assessment_version_id, position, skill, item_type, prompt, answer_key, rubric) values
               (${quote(id("9c", 1))}, ${quote(version)}, 1, 'GRAMMAR', 'MULTIPLE_CHOICE',
                '{"prompt":"Choose the correct sentence.","options":[{"id":"a","label":"She works in a bank."},{"id":"b","label":"She work in a bank."}]}',
                '{"optionId":"a"}', null),
               (${quote(id("9c", 2))}, ${quote(version)}, 2, 'SPEAKING', 'MANUAL_TEXT',
                '{"prompt":"Describe your daily routine.","instructions":"Write a short answer for the teacher."}',
                null, '{"instructions":"Human review only."}');
             update public.assessment_versions set status = 'PUBLISHED', published_at = now() where id = ${quote(version)};
           end if;
         end $$;`);
  }
  const items =
    sql(`select id || '|' || item_type || '|' || coalesce(prompt #>> '{options,0,id}', '')
      from public.assessment_items where assessment_version_id = ${quote(version)} order by position`)
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [itemId, type, firstOption] = line.split("|");
        return { itemId, type, firstOption };
      });

  const finalizeReview = (person) => {
    const caseId = sql(`select id from public.placement_cases where user_id = ${quote(person.id)}`);
    sqlAs(
      DEV.teacher.id,
      `select public.finalize_placement_review(${quote(caseId)}::uuid, ${quote(COURSE)}::uuid,
         'Boa base de gramática e vocabulário. Recomendo Foundations com foco em conversação.', 'HIGH')`,
    );
  };
  for (const person of PLACEMENT) {
    await step(`entrada ${person.email}`, async () => {
      sql(`insert into public.teacher_student_assignments(teacher_id, student_user_id, course_id, created_by_user_id)
        select ${quote(teacherId)}, ${quote(person.id)}, ${quote(COURSE)}, ${quote(DEV.admin.id)}
        where not exists (select 1 from public.teacher_student_assignments
          where teacher_id = ${quote(teacherId)} and student_user_id = ${quote(person.id)} and ends_at is null)`);
      const client = await clientOf(person);
      const stateOf = () =>
        sql(`select state from public.placement_cases where user_id = ${quote(person.id)}`);
      if (["", "PAYMENT_CONFIRMED", "ASSESSMENT_REQUIRED"].includes(stateOf())) {
        await rpc(client, "begin_placement", {});
        await rpc(client, "save_placement_preferences", {
          p_timezone: "America/Recife",
          p_weekday: 1,
          p_start_minute: 1080,
          p_end_minute: 1260,
        });
        await rpc(client, "start_placement_assessment", {});
      }
      if (stateOf() !== "IN_PROGRESS") {
        if (person.stage === "PLACEMENT_READY" && stateOf() === "REVIEW_PENDING") {
          finalizeReview(person);
        }
        return; // já avançou em execução anterior
      }
      const attempt = sql(
        `select assessment_attempt_id from public.placement_cases where user_id = ${quote(person.id)}`,
      );
      const answers = items.map((item) =>
        item.type === "MULTIPLE_CHOICE"
          ? { optionId: item.firstOption }
          : { text: "I wake up at seven, I go to work by bus and I study English in the evening." },
      );
      const toAnswer = person.stage === "IN_PROGRESS" ? 1 : items.length;
      for (const [index, item] of items.slice(0, toAnswer).entries()) {
        await rpc(client, "record_assessment_response", {
          p_assessment_attempt_id: attempt,
          p_assessment_item_id: item.itemId,
          p_response: answers[index],
        });
      }
      if (person.stage === "IN_PROGRESS") return;
      await rpc(client, "complete_assessment_attempt", { p_assessment_attempt_id: attempt });
      if (person.stage === "PLACEMENT_READY") finalizeReview(person);
    });
  }
});

// ---------------------------------------------------------------- comercial e operação

console.log("7/8 Leads, suporte, ocorrências e conciliação");
const LEADS = [
  ["Ana Clara Souza", "ana.clara@example.test", null, "Instagram", "NEW", "HOT", 179.9],
  ["Pedro Henrique Silva", null, "+55 81 98888-1001", "Indicação", "NEW", "WARM", 99.9],
  [
    "Larissa Gomes",
    "larissa.gomes@example.test",
    "+55 81 97777-2002",
    "Site",
    "CONTACTED",
    "WARM",
    179.9,
  ],
  ["Bruno Carvalho", "bruno.c@example.test", null, "Google", "CONTACTED", "COLD", 99.9],
  [
    "Fernanda Lopes",
    "fernanda.lopes@example.test",
    "+55 81 96666-3003",
    "Instagram",
    "QUALIFIED",
    "HOT",
    329.9,
  ],
  ["Diego Araújo", "diego.araujo@example.test", null, "Evento", "QUALIFIED", "WARM", 179.9],
  ["Lucas Almeida", "lucas.dev@example.test", null, "Site", "WON", "HOT", 179.9],
  ["Patrícia Moura", "patricia.moura@example.test", null, "Indicação", "LOST", "COLD", null],
];
await step("leads", async () => {
  must(
    await admin.from("crm_leads").upsert(
      LEADS.map(([name, email, phone, source, stage, temperature, value], index) => ({
        id: id("60", index + 1),
        name,
        email,
        phone,
        source,
        stage,
        temperature,
        estimated_value: value,
        owner_user_id: DEV.admin.id,
        linked_user_id: stage === "WON" ? EXTRA[0].id : null,
      })),
      { onConflict: "id" },
    ),
    "crm_leads",
  );
  must(
    await admin.from("crm_interactions").upsert(
      [
        [1, "NOTE", "Pediu informações sobre o plano Talk pelo direct."],
        [3, "CALL", "Ligação de 10 min: quer aulas à noite, prefere segunda e quarta."],
        [5, "MEETING", "Aula experimental agendada; gostou do método."],
        [7, "EMAIL", "Enviado link de pagamento; assinatura confirmada."],
      ].map(([lead, type, summary], index) => ({
        id: id("61", index + 1),
        lead_id: id("60", lead),
        interaction_type: type,
        summary,
        actor_user_id: DEV.admin.id,
        occurred_at: iso(at(-index - 1, 15)),
      })),
      { onConflict: "id" },
    ),
    "crm_interactions",
  );
  must(
    await admin.from("crm_tasks").upsert(
      [
        { n: 1, lead: 1, title: "Responder Ana Clara com a tabela de planos", due: at(1, 10) },
        { n: 2, lead: 5, title: "Enviar proposta do plano Boost para Fernanda", due: at(2, 15) },
        {
          n: 3,
          lead: 3,
          title: "Confirmar horário da aula experimental",
          due: at(-1, 11),
          done: true,
        },
      ].map((task) => ({
        id: id("62", task.n),
        lead_id: id("60", task.lead),
        owner_user_id: DEV.admin.id,
        title: task.title,
        due_at: iso(task.due),
        status: task.done ? "COMPLETED" : "OPEN",
        completed_at: task.done ? iso(at(-1, 12)) : null,
      })),
      { onConflict: "id" },
    ),
    "crm_tasks",
  );
});

await step("chamados de suporte", async () => {
  const byKey = (key) => personByKey(key).id;
  must(
    await admin.from("support_tickets").upsert(
      [
        [
          1,
          "rafael",
          "PAYMENT",
          "Cobrança não aparece no cartão",
          "Meu cartão foi trocado e a mensalidade de outubro ficou pendente. Como atualizo os dados de pagamento?",
          "OPEN",
          null,
        ],
        [
          2,
          "student",
          "CLASSES",
          "Remarcar a aula particular",
          "Tive um imprevisto no trabalho. Consigo trocar a sessão particular de sexta para a semana que vem?",
          "IN_PROGRESS",
          "Verificando a agenda da professora Yasminn.",
        ],
        [
          3,
          "camila",
          "ACCESS",
          "Não consigo abrir a aula 2",
          "A aula Introductions that sound natural aparece bloqueada para mim, mesmo depois de terminar a primeira.",
          "OPEN",
          null,
        ],
        [
          4,
          "beatriz",
          "ACCOUNT",
          "Trocar meu e-mail de acesso",
          "Quero usar meu e-mail pessoal em vez do e-mail do trabalho para entrar na plataforma.",
          "RESOLVED",
          "Feito! Use o novo e-mail no próximo login.",
        ],
      ].map(([n, key, category, subject, body, status, note]) => ({
        id: id("70", n),
        user_id: byKey(key),
        category,
        subject,
        body,
        status,
        admin_note: note,
        created_at: iso(at(-n, 10)),
      })),
      { onConflict: "id" },
    ),
    "support_tickets",
  );
});

await step("ocorrências", async () => {
  must(
    await admin.from("operational_incidents").upsert(
      [
        {
          id: id("71", 1),
          dedupe_key: "dev-seed:review-overdue",
          kind: "REVIEW_OVERDUE",
          severity: "HIGH",
          status: "OPEN",
          title: "Revisão de nivelamento de Helena Duarte passou de 24 horas",
          source_path: "/admin/enrollments",
          first_seen_at: iso(at(-2, 9)),
        },
        {
          id: id("71", 2),
          dedupe_key: "dev-seed:billing-rafael",
          kind: "BILLING_DISCREPANCY",
          severity: "MEDIUM",
          status: "ACKNOWLEDGED",
          assignee_user_id: DEV.admin.id,
          title: "Assinatura de Rafael Nunes em atraso sem cobrança vencida no provedor",
          source_path: "/admin/billing",
          first_seen_at: iso(at(-1, 8)),
        },
        {
          id: id("71", 3),
          dedupe_key: "dev-seed:notification",
          kind: "NOTIFICATION_FAILED",
          severity: "LOW",
          status: "OPEN",
          title: "E-mail de confirmação de reserva não foi entregue para Camila Ferreira",
          source_path: "/admin/students",
          first_seen_at: iso(at(0, 7)),
        },
      ],
      { onConflict: "id" },
    ),
    "operational_incidents",
  );
});

await step("conciliação de cobrança", async () => {
  const subscription = subscriptionIds["rafael.dev@example.test"];
  if (!subscription) throw new Error("assinatura do Rafael ausente");
  must(
    await admin.from("billing_reconciliation_findings").upsert(
      {
        id: id("72", 1),
        subscription_id: subscription,
        kind: "PAST_DUE_WITHOUT_OVERDUE_CHARGE",
        detail: { provider: "dev-seed", note: "Status local PAST_DUE sem cobrança vencida." },
        status: "OPEN",
      },
      { onConflict: "id" },
    ),
    "billing_reconciliation_findings",
  );
});

await step("anotações e novo teste solicitado", async () => {
  must(
    await admin.from("teacher_student_notes").upsert(
      {
        id: id("73", 1),
        teacher_id: teacherId,
        student_user_id: DEV.student.id,
        cohort_id: COHORTS[0].id,
        body: "Marina participa bem em grupo. Trabalhar conectores e passado simples nas próximas aulas.",
      },
      { onConflict: "id" },
    ),
    "teacher_student_notes",
  );
  must(
    await admin.from("reassessment_requests").upsert(
      {
        id: id("74", 1),
        student_user_id: EXTRA.find((p) => p.key === "thiago").id,
        requested_by_user_id: DEV.teacher.id,
        reason: "Evoluiu rápido nas últimas semanas; vale refazer o teste de entrada.",
        status: "OPEN",
      },
      { onConflict: "id" },
    ),
    "reassessment_requests",
  );
});

// ---------------------------------------------------------------- validação dos logins

console.log("8/8 Validando os logins de desenvolvimento");
const summary = [];
for (const person of Object.values(DEV)) {
  const row = { papel: person.role, email: person.email, login: "FALHOU", mfa: "-" };
  try {
    const client = await signIn(person.email, person.password);
    const { data: roles } = await client.from("user_roles").select("role");
    row.login = `OK (${(roles ?? []).map((r) => r.role).join(", ") || "sem papel visível"})`;
    if (person.role !== "STUDENT") {
      const { data } = await admin.auth.admin.mfa.listFactors({ userId: person.id });
      const verified = (data?.factors ?? []).some((factor) => factor.status === "verified");
      row.mfa = verified ? "autenticador já cadastrado" : "cadastrar no 1º acesso (QR code)";
    }
  } catch (error) {
    row.login = `FALHOU: ${error.message}`;
  }
  summary.push(row);
}
console.table(summary);

if (warnings.length) {
  console.warn(`\n${warnings.length} etapa(s) com aviso (o resto foi criado):`);
  for (const warning of warnings) console.warn(`  - ${warning}`);
}
console.log("\nSeed de desenvolvimento concluído.");
if (summary.some((row) => row.login.startsWith("FALHOU"))) process.exitCode = 1;
