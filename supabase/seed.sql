-- Deterministic development seed for PROMPT 05.
-- Product plans are data; application authorization must resolve entitlements instead of branching on plan codes.

insert into public.plans (id, code, name, description, currency, amount_cents, billing_interval, active)
values
  ('10000000-0000-0000-0000-000000000001', 'START', 'Start', 'Constância com portal completo e Core Class semanal.', 'BRL', 9990, 'MONTH', true),
  ('10000000-0000-0000-0000-000000000002', 'TALK', 'Talk', 'Conversação frequente com Core Class e Conversation Lab.', 'BRL', 17990, 'MONTH', true),
  ('10000000-0000-0000-0000-000000000003', 'BOOST', 'Boost', 'Aceleração com mais labs, sessão particular e acompanhamento.', 'BRL', 32990, 'MONTH', true)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  description = excluded.description,
  currency = excluded.currency,
  amount_cents = excluded.amount_cents,
  billing_interval = excluded.billing_interval,
  active = excluded.active;

insert into public.entitlements (id, key, description, unit, active)
values
  ('20000000-0000-0000-0000-000000000001', 'weekly_core_classes', 'Quantidade de Core Classes disponíveis por semana.', 'COUNT', true),
  ('20000000-0000-0000-0000-000000000002', 'weekly_conversation_labs', 'Quantidade de Conversation Labs disponíveis por semana.', 'COUNT', true),
  ('20000000-0000-0000-0000-000000000003', 'monthly_private_sessions', 'Quantidade de sessões particulares disponíveis por mês.', 'COUNT', true)
on conflict (id) do update set
  key = excluded.key,
  description = excluded.description,
  unit = excluded.unit,
  active = excluded.active;

insert into public.plan_entitlements
  (id, plan_id, entitlement_id, limit_value, cadence, effective_from)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'WEEK', '2026-01-01T00:00:00Z'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 0, 'WEEK', '2026-01-01T00:00:00Z'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 0, 'MONTH', '2026-01-01T00:00:00Z'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 1, 'WEEK', '2026-01-01T00:00:00Z'),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 1, 'WEEK', '2026-01-01T00:00:00Z'),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 0, 'MONTH', '2026-01-01T00:00:00Z'),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 1, 'WEEK', '2026-01-01T00:00:00Z'),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 2, 'WEEK', '2026-01-01T00:00:00Z'),
  ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 1, 'MONTH', '2026-01-01T00:00:00Z')
on conflict (id) do update set
  plan_id = excluded.plan_id,
  entitlement_id = excluded.entitlement_id,
  limit_value = excluded.limit_value,
  cadence = excluded.cadence,
  effective_from = excluded.effective_from,
  effective_to = null;

insert into public.courses (id, slug, title, description, active)
values (
  '40000000-0000-0000-0000-000000000001',
  'yas-foundations',
  'Yas Foundations',
  'Curso mínimo de desenvolvimento para validar contratos de trilha sem inventar conteúdo de produção.',
  true
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  active = excluded.active;

insert into public.modules (id, course_id, position, title, description)
values (
  '41000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  1,
  'Getting Started',
  'Módulo mínimo para desenvolvimento.'
)
on conflict (id) do update set
  course_id = excluded.course_id,
  position = excluded.position,
  title = excluded.title,
  description = excluded.description;

insert into public.lessons (id, module_id, position, slug, title, estimated_minutes)
values (
  '42000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  1,
  'welcome-to-yas',
  'Welcome to Yas',
  10
)
on conflict (id) do update set
  module_id = excluded.module_id,
  position = excluded.position,
  slug = excluded.slug,
  title = excluded.title,
  estimated_minutes = excluded.estimated_minutes;
