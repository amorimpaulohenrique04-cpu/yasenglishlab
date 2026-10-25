#!/usr/bin/env node
// Fixture local focado na Entrada. Nunca reseta ou reabre revisões já concluídas.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const databaseUrl = process.env.DATABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
for (const value of [apiUrl, databaseUrl]) {
  if (!value || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname)) {
    throw new Error("Este seed exige API e banco em localhost.");
  }
}
if (!key) throw new Error("Chave server-only local ausente.");

const seed = "teacher-entry-demo-v1";
const client = createClient(apiUrl, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
function sql(input) {
  const db = new URL(databaseUrl);
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-Atq", "-f", "-"], {
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      PGHOST: db.hostname,
      PGPORT: db.port || "5432",
      PGDATABASE: db.pathname.slice(1),
      PGUSER: decodeURIComponent(db.username),
      PGPASSWORD: decodeURIComponent(db.password),
      PGCLIENTENCODING: "UTF8",
    },
  });
  if (result.error) throw new Error(`psql indisponível: ${result.error.code}`);
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout.trim();
}
function must(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const teacher = sql(`select t.id || '|' || t.user_id from public.teachers t
  join auth.users u on u.id=t.user_id where u.email='teacher.dev@example.test' and t.active`);
if (!teacher) throw new Error("Professor de desenvolvimento não encontrado.");
const [teacherId, teacherUserId] = teacher.split("|");
const adminId = sql("select id from auth.users where email='admin.dev@example.test'");
if (!adminId) throw new Error("Admin de desenvolvimento não encontrado.");
const courseId = "40000000-0000-4000-8000-000000000001";
const versionId = sql(`select v.id from public.assessment_versions v
  join public.assessments a on a.id=v.assessment_id
  where a.is_placement and a.active and v.status='PUBLISHED'
  order by v.published_at desc,v.id limit 1`);
if (!versionId) throw new Error("Nenhum teste de entrada publicado; publique antes do seed.");
const items = JSON.parse(
  sql(`select json_agg(json_build_object('id',id,'type',item_type,
  'options',prompt->'options') order by position) from public.assessment_items
  where assessment_version_id=${quote(versionId)}::uuid`),
);
if (
  !items?.length ||
  items.some((item) => !["MULTIPLE_CHOICE", "MANUAL_TEXT"].includes(item.type))
) {
  throw new Error("A avaliação deve conter questões de múltipla escolha ou texto manual.");
}

const people = [
  {
    key: "ana",
    name: "Ana Martins · Demo",
    option: 0,
    answer:
      "I wake up at seven and have breakfast with my family. I work at a bookstore and study English in the evening. I want to talk to customers from other countries.",
  },
  {
    key: "bruno",
    name: "Bruno Oliveira · Demo",
    option: 1,
    answer:
      "I wake up six o'clock. I go work by bus. In night I study English because I want travel. I like music and movies.",
  },
  {
    key: "carolina",
    name: "Carolina Santos · Demo",
    option: 0,
    answer:
      "I usually start my day with a short walk before working from home. Although I can read English at work, I find spontaneous conversations challenging. I would like to feel more confident during meetings.",
  },
  {
    key: "diego",
    name: "Diego Pereira · Demo",
    option: 1,
    answer:
      "My name is Diego. I work in a restaurant. I get up at eight. I like football. I want learn English for my job.",
  },
];

const users = [];
for (let page = 1; ; page++) {
  const batch = must(await client.auth.admin.listUsers({ page, perPage: 1000 })).users;
  users.push(...batch);
  if (batch.length < 1000) break;
}
for (const person of people) {
  const email = `${person.key}.entry-demo@example.test`;
  let user = users.find((entry) => entry.email === email);
  if (user && user.user_metadata?.seed !== seed) {
    throw new Error(`Usuário existente fora deste seed: ${email}`);
  }
  if (!user) {
    user = must(
      await client.auth.admin.createUser({
        email,
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { display_name: person.name, seed },
      }),
    ).user;
  }
  person.id = user.id;
}

const statements = people.map((person) => {
  const responses = items
    .map((item) => {
      const response =
        item.type === "MANUAL_TEXT"
          ? { text: person.answer }
          : {
              optionId: item.options[Math.min(person.option, item.options.length - 1)].id,
            };
      return `perform public.record_assessment_response(attempt_id,${quote(item.id)}::uuid,
      ${quote(JSON.stringify(response))}::jsonb);`;
    })
    .join("\n");
  return `
    insert into public.profiles(user_id,display_name) values (${quote(person.id)},${quote(person.name)})
      on conflict(user_id) do nothing;
    insert into public.user_roles(user_id,role) values (${quote(person.id)},'STUDENT')
      on conflict(user_id,role) do nothing;
    insert into public.subscriptions(user_id,plan_id,provider,provider_customer_id,
      provider_subscription_id,status,current_period_start,current_period_end,started_at)
      values (${quote(person.id)},'10000000-0000-0000-0000-000000000002','dev-seed',
        'cus_entry_demo_${person.key}','sub_entry_demo_${person.key}','ACTIVE',
        now()-interval '1 day',now()+interval '30 days',now()-interval '1 day')
      on conflict(provider,provider_subscription_id) do nothing;
    insert into public.teacher_student_assignments(teacher_id,student_user_id,course_id,created_by_user_id)
      select ${quote(teacherId)},${quote(person.id)},${quote(courseId)},${quote(adminId)}
      where not exists(select 1 from public.teacher_student_assignments
        where teacher_id=${quote(teacherId)} and student_user_id=${quote(person.id)}
          and starts_at<=now() and (ends_at is null or ends_at>now()));
    set local role authenticated;
    select set_config('request.jwt.claim.sub',${quote(person.id)},true);
    select set_config('request.jwt.claims',${quote(JSON.stringify({ sub: person.id, role: "authenticated", aal: "aal1" }))},true);
    do $$ declare case_id uuid; attempt_id uuid; current_state text; begin
      case_id := public.begin_placement();
      select state into current_state from public.placement_cases where id=case_id;
      if current_state='PAYMENT_CONFIRMED' then
        perform public.save_placement_preferences('America/Recife',1,1080,1260);
      end if;
      select state into current_state from public.placement_cases where id=case_id;
      if current_state in ('ASSESSMENT_REQUIRED','IN_PROGRESS') then
        attempt_id := public.start_placement_assessment();
        ${responses}
        perform public.complete_assessment_attempt(attempt_id);
      end if;
    end $$;
    reset role;`;
});
sql(`begin; ${statements.join("\n")} commit;`);

const claims = JSON.stringify({ sub: teacherUserId, role: "authenticated", aal: "aal2" });
const queue = JSON.parse(
  sql(`begin; set local role authenticated;
  do $$ begin
    perform set_config('request.jwt.claim.sub',${quote(teacherUserId)},true);
    perform set_config('request.jwt.claims',${quote(claims)},true);
  end $$;
  select coalesce(json_agg(q),'[]'::json) from public.get_placement_queue('REVIEW_PENDING','TEACHER') q; commit;`),
);
const cases = JSON.parse(
  sql(`select json_agg(json_build_object('name',p.display_name,
  'id',c.id,'state',c.state,'responses',(select count(*) from public.assessment_responses r
    where r.assessment_attempt_id=c.assessment_attempt_id)))
  from public.placement_cases c join public.profiles p on p.user_id=c.user_id
  where c.user_id in (${people.map((person) => quote(person.id)).join(",")})`),
);
if (
  cases.length !== 4 ||
  cases.some((entry) => entry.state === "IN_PROGRESS" || entry.responses !== items.length)
) {
  throw new Error("Seed incompleto: confira as tentativas locais.");
}
const visibleIds = new Set(queue.map((entry) => entry.case.id));
if (cases.some((entry) => entry.state === "REVIEW_PENDING" && !visibleIds.has(entry.id))) {
  throw new Error("Caso pendente não apareceu na fila autorizada do professor.");
}
console.log(
  JSON.stringify(
    {
      cases,
      pendingVisibleToTeacher: queue.filter((entry) =>
        people.some((person) => person.id === entry.case.user_id),
      ).length,
    },
    null,
    2,
  ),
);
