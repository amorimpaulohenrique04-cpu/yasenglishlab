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
  '40000000-0000-4000-8000-000000000001',
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
  '41000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
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
values
  (
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    1,
    'welcome-to-yas',
    'Welcome to Yas',
    10
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000001',
    2,
    'introductions-that-sound-natural',
    'Introductions that sound natural',
    14
  ),
  (
    '42000000-0000-4000-8000-000000000003',
    '41000000-0000-4000-8000-000000000001',
    3,
    'build-your-first-conversation',
    'Build your first conversation',
    18
  )
on conflict (id) do update set
  module_id = excluded.module_id,
  position = excluded.position,
  slug = excluded.slug,
  title = excluded.title,
  estimated_minutes = excluded.estimated_minutes;

insert into public.lesson_assets (
  id,
  lesson_id,
  asset_type,
  position,
  content,
  metadata
)
values
  (
    '43000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    'TEXT',
    1,
    '{"eyebrow":"Getting Started","title":"Start with what you already know","body":"Your first lesson is about using simple English with confidence. Focus on meaning before perfection.","steps":["Notice familiar words and expressions.","Say one short sentence out loud.","Return later and continue from your saved point."]}'::jsonb,
    '{"canonical_slice":true}'::jsonb
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    '42000000-0000-4000-8000-000000000002',
    'TEXT',
    1,
    '{"eyebrow":"Getting Started","title":"Make introductions feel natural","body":"Build a short introduction around your name, where you are from and one thing you enjoy.","steps":["Keep sentences short.","Connect ideas with and or but.","Say it again with a calmer pace."]}'::jsonb,
    '{"canonical_slice":true}'::jsonb
  ),
  (
    '43000000-0000-4000-8000-000000000003',
    '42000000-0000-4000-8000-000000000003',
    'TEXT',
    1,
    '{"eyebrow":"Getting Started","title":"Turn sentences into a conversation","body":"Use a simple question and follow-up to keep a conversation moving without memorizing a script.","steps":["Ask one open question.","Listen for one detail.","Use that detail in your next question."]}'::jsonb,
    '{"canonical_slice":true}'::jsonb
  )
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  asset_type = excluded.asset_type,
  position = excluded.position,
  content = excluded.content,
  metadata = excluded.metadata;

insert into public.materials (
  id,
  title,
  material_type,
  module_id,
  lesson_id,
  storage_path,
  metadata,
  active,
  required_entitlement_key
)
values
  (
    '81710000-0000-4000-8000-000000000001',
    'Welcome Summary',
    'SUMMARY',
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    'materials/getting-started/welcome-summary.pdf',
    '{"pages":8}'::jsonb,
    true,
    null
  ),
  (
    '81710000-0000-4000-8000-000000000002',
    'Natural Introductions Vocabulary',
    'VOCABULARY',
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000002',
    'materials/getting-started/natural-introductions-vocabulary.pdf',
    '{"words":24}'::jsonb,
    true,
    null
  ),
  (
    '81710000-0000-4000-8000-000000000003',
    'Present Simple Guide',
    'GRAMMAR',
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000002',
    'materials/getting-started/present-simple-guide.pdf',
    '{"pages":6}'::jsonb,
    true,
    null
  ),
  (
    '81710000-0000-4000-8000-000000000004',
    'Conversation Listening Pack',
    'AUDIO',
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000003',
    'materials/getting-started/conversation-listening-pack.mp3',
    '{"duration_minutes":12}'::jsonb,
    true,
    null
  ),
  (
    '81710000-0000-4000-8000-000000000005',
    'First Conversation Worksheet',
    'WORKSHEET',
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000003',
    'materials/getting-started/first-conversation-worksheet.pdf',
    '{"pages":4}'::jsonb,
    true,
    null
  ),
  (
    '81710000-0000-4000-8000-000000000006',
    'First Conversation Answer Key',
    'ANSWER_KEY',
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000003',
    'materials/getting-started/first-conversation-answer-key.pdf',
    '{"pages":2}'::jsonb,
    true,
    null
  )
on conflict (id) do update set
  title = excluded.title,
  material_type = excluded.material_type,
  module_id = excluded.module_id,
  lesson_id = excluded.lesson_id,
  storage_path = excluded.storage_path,
  external_url = null,
  metadata = excluded.metadata,
  active = excluded.active,
  required_entitlement_key = excluded.required_entitlement_key;

-- P15 Practice content. CEFR targets are context only and never a learner result.
-- Listening remains absent until an approved audio asset is available.
insert into public.practice_activities (
  id,
  slug,
  title,
  skill,
  cefr_target,
  difficulty,
  estimated_minutes,
  related_module_id,
  related_lesson_id,
  content,
  active
)
values
  (
    '83000000-0000-4000-8000-000000000001',
    'natural-introductions-vocabulary',
    'Vocabulário para apresentações',
    'VOCABULARY',
    'A1',
    'FOUNDATION',
    5,
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000002',
    '{"kind":"MULTIPLE_CHOICE","evaluationMode":"DETERMINISTIC","prompt":"Qual expressão completa naturalmente: Nice to ___ you.","options":[{"id":"meet","label":"meet"},{"id":"meeting","label":"meeting"},{"id":"met","label":"met"}]}'::jsonb,
    true
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    'present-simple-introductions',
    'Present simple em contexto',
    'GRAMMAR',
    'A1',
    'FOUNDATION',
    6,
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000002',
    '{"kind":"MULTIPLE_CHOICE","evaluationMode":"DETERMINISTIC","prompt":"Escolha a frase correta para falar sobre rotina.","options":[{"id":"work","label":"I work from home on Fridays."},{"id":"works","label":"I works from home on Fridays."},{"id":"working","label":"I working from home on Fridays."}]}'::jsonb,
    true
  ),
  (
    '83000000-0000-4000-8000-000000000003',
    'two-minute-introduction',
    'Apresentação em dois minutos',
    'SPEAKING',
    'A1',
    'FOUNDATION',
    5,
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000002',
    '{"kind":"MANUAL_TEXT","evaluationMode":"MANUAL_PENDING","prompt":"Prepare uma apresentação curta com seu nome, sua cidade e algo que você gosta.","instructions":"Registre o roteiro que você praticou. Nenhum score automático será criado."}'::jsonb,
    true
  ),
  (
    '83000000-0000-4000-8000-000000000004',
    'introduction-word-stress',
    'Ritmo de uma apresentação',
    'PRONUNCIATION',
    'A1',
    'FOUNDATION',
    4,
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000002',
    '{"kind":"MANUAL_TEXT","evaluationMode":"MANUAL_PENDING","prompt":"Pratique três vezes: My name is Ana and I live in São Paulo.","instructions":"Marque no texto as palavras que você enfatizou. A avaliação automática de pronúncia não está habilitada."}'::jsonb,
    true
  )
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  skill = excluded.skill,
  cefr_target = excluded.cefr_target,
  difficulty = excluded.difficulty,
  estimated_minutes = excluded.estimated_minutes,
  related_module_id = excluded.related_module_id,
  related_lesson_id = excluded.related_lesson_id,
  content = excluded.content,
  active = excluded.active;

insert into private.practice_answer_keys (practice_activity_id, answer_key, feedback)
values
  (
    '83000000-0000-4000-8000-000000000001',
    '{"optionId":"meet"}'::jsonb,
    '{"correct":"Correto: Nice to meet you é a expressão usada ao conhecer alguém.","incorrect":"A forma correta é meet: Nice to meet you."}'::jsonb
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '{"optionId":"work"}'::jsonb,
    '{"correct":"Correto: com I, usamos work no present simple.","incorrect":"Com I, use a forma base: I work from home on Fridays."}'::jsonb
  )
on conflict (practice_activity_id) do update set
  answer_key = excluded.answer_key,
  feedback = excluded.feedback;

-- Practice v3 examples (docs/PRACTICE_V3.md section 7), linked to lesson 1 "Welcome to Yas" so a new Student reaches them.
-- 1. Grammar/vocabulary: 7 mixed objective items with per-option explanations (English items, Portuguese feedback).
-- 2. Pronunciation: AUDIO model + SPOKEN response per item (manual Teacher review, never scored automatically).
-- The two model-audio assets are PLACEHOLDER rows: status READY so the practice publishes, but no file exists in the
-- private storage bucket 'yas-practice-assets' (path seed/practice-pronunciation/*.mp3). Upload real audio under the same
-- path, or duplicate the practice and attach new audio through the Teacher builder, before using it with real Students.
insert into public.practice_activities (
  id, slug, title, skill, cefr_target, difficulty, estimated_minutes, related_module_id, related_lesson_id, content, active
)
values
  (
    '83000000-0000-4000-8000-000000000005',
    'welcome-greetings-present-simple',
    'Cumprimentos e present simple',
    'GRAMMAR',
    'A1',
    'FOUNDATION',
    8,
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    $json${
      "version": 3,
      "objective": "Ao final você consegue cumprimentar alguém e falar da sua rotina com o present simple.",
      "askConfidence": true,
      "instructions": "Responda uma pergunta por vez. Se errar, você revê a explicação e tenta de novo no final.",
      "evaluationMode": "DETERMINISTIC",
      "items": [
        {"id": "greet-1", "prompt": "Você acabou de conhecer alguém. Qual frase é natural?", "stimulus": {"type": "NONE"},
         "response": {"type": "CHOICE_SINGLE", "options": [
           {"id": "a", "label": "Nice to meet you."}, {"id": "b", "label": "Nice to meeting you."}, {"id": "c", "label": "Nice to met you."}]}},
        {"id": "greet-2", "prompt": "Qual resposta combina com a pergunta \"How are you?\"", "stimulus": {"type": "NONE"},
         "response": {"type": "CHOICE_SINGLE", "options": [
           {"id": "a", "label": "I'm fine, thanks. And you?"}, {"id": "b", "label": "I am name Ana."}, {"id": "c", "label": "Yes, I do."}]}},
        {"id": "be-1", "prompt": "Complete a apresentação com a forma correta do verbo to be.", "stimulus": {"type": "NONE"},
         "response": {"type": "CLOZE", "text": "My name {{1}} Ana and I {{2}} from Brazil."}},
        {"id": "ps-1", "prompt": "Complete a frase sobre a rotina de Ana.", "stimulus": {"type": "TEXT", "text": "She ___ coffee every morning."},
         "response": {"type": "CHOICE_SINGLE", "options": [
           {"id": "a", "label": "drink"}, {"id": "b", "label": "drinks"}, {"id": "c", "label": "drinking"}]}},
        {"id": "ps-2", "prompt": "Quais frases estão corretas no present simple? Marque todas.", "stimulus": {"type": "NONE"},
         "response": {"type": "CHOICE_MULTI", "options": [
           {"id": "a", "label": "I live in Recife."}, {"id": "b", "label": "She live in Recife."},
           {"id": "c", "label": "They study English."}, {"id": "d", "label": "We studies English."}]}},
        {"id": "ps-3", "prompt": "Esta frase está gramaticalmente correta?", "stimulus": {"type": "NONE"},
         "response": {"type": "TRUE_FALSE", "statement": "He plays soccer on Sundays."}},
        {"id": "order-1", "prompt": "Coloque as palavras em ordem para formar uma frase.", "stimulus": {"type": "NONE"},
         "response": {"type": "ORDERING", "items": [
           {"id": "w-am", "label": "am"}, {"id": "w-student", "label": "student"}, {"id": "w-i", "label": "I"}, {"id": "w-a", "label": "a"}]}}
      ]
    }$json$::jsonb,
    true
  ),
  (
    '83000000-0000-4000-8000-000000000006',
    'welcome-repeat-after-the-model',
    'Repita depois do modelo',
    'PRONUNCIATION',
    'A1',
    'FOUNDATION',
    5,
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    $json${
      "version": 3,
      "objective": "Ao final você consegue repetir cumprimentos com ritmo e entonação naturais.",
      "askConfidence": false,
      "instructions": "Ouça o modelo quantas vezes quiser, depois grave a sua versão. Seu professor vai ouvir e comentar.",
      "evaluationMode": "MANUAL_PENDING",
      "items": [
        {"id": "say-1", "prompt": "Ouça o modelo e repita: \"Nice to meet you.\"",
         "stimulus": {"type": "AUDIO", "assetId": "83100000-0000-4000-8000-000000000001", "transcript": "Nice to meet you."},
         "response": {"type": "SPOKEN"}, "planningSeconds": 30},
        {"id": "say-2", "prompt": "Ouça o modelo e repita: \"My name is Ana, and I live in Recife.\"",
         "stimulus": {"type": "AUDIO", "assetId": "83100000-0000-4000-8000-000000000002", "transcript": "My name is Ana, and I live in Recife."},
         "response": {"type": "SPOKEN"}, "planningSeconds": 30}
      ]
    }$json$::jsonb,
    true
  )
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  skill = excluded.skill,
  cefr_target = excluded.cefr_target,
  difficulty = excluded.difficulty,
  estimated_minutes = excluded.estimated_minutes,
  related_module_id = excluded.related_module_id,
  related_lesson_id = excluded.related_lesson_id,
  content = excluded.content,
  active = excluded.active;

insert into public.practice_activity_assets (id, practice_activity_id, asset_type, storage_path, provider, upload_status, metadata)
values
  ('83100000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000006', 'AUDIO',
   'seed/practice-pronunciation/nice-to-meet-you.mp3', 'seed', 'READY', '{"mime_type":"audio/mpeg","placeholder":true}'::jsonb),
  ('83100000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000006', 'AUDIO',
   'seed/practice-pronunciation/my-name-is-ana.mp3', 'seed', 'READY', '{"mime_type":"audio/mpeg","placeholder":true}'::jsonb)
on conflict (id) do update set
  practice_activity_id = excluded.practice_activity_id,
  asset_type = excluded.asset_type,
  storage_path = excluded.storage_path,
  provider = excluded.provider,
  upload_status = excluded.upload_status,
  metadata = excluded.metadata;

insert into private.practice_item_keys (practice_activity_id, item_id, answer_key, feedback)
values
  ('83000000-0000-4000-8000-000000000005', 'greet-1', '{"optionId":"a"}'::jsonb,
   '{"correct":"Isso! Nice to meet you é a forma natural de dizer prazer em conhecer.",
     "incorrect":"Depois de to usamos o verbo na forma base: Nice to meet you.",
     "options":{"a":"Correto: to + verbo na forma base (to meet).","b":"Depois de to o verbo fica na forma base (meet), não em -ing.","c":"met é o passado de meet. Depois de to, use a forma base: meet."}}'::jsonb),
  ('83000000-0000-4000-8000-000000000005', 'greet-2', '{"optionId":"a"}'::jsonb,
   '{"correct":"Muito bem: responder e devolver a pergunta soa natural.",
     "incorrect":"How are you? pergunta como você está. Responda como está, por exemplo: I''m fine, thanks.",
     "options":{"a":"Correto: diz como você está e devolve a pergunta (And you?).","b":"I am name Ana mistura duas ideias. Para o nome, use My name is Ana.","c":"Yes, I do responde perguntas com Do you...? e não How are you?."}}'::jsonb),
  ('83000000-0000-4000-8000-000000000005', 'be-1', '{"blanks":[{"id":"1","accepted":["is"]},{"id":"2","accepted":["am"]}]}'::jsonb,
   '{"correct":"Perfeito: My name is... e I am from...","incorrect":"Use is com My name (terceira pessoa) e am com I."}'::jsonb),
  ('83000000-0000-4000-8000-000000000005', 'ps-1', '{"optionId":"b"}'::jsonb,
   '{"correct":"Com she, he e it o verbo ganha -s: she drinks.",
     "incorrect":"Com she, he e it, o verbo do present simple ganha -s: she drinks.",
     "options":{"a":"drink serve para I, you, we e they. Com she, falta o -s.","b":"Correto: she + verbo com -s (drinks).","c":"drinking é a forma -ing e pede o verbo to be (she is drinking)."}}'::jsonb),
  ('83000000-0000-4000-8000-000000000005', 'ps-2', '{"optionIds":["a","c"]}'::jsonb,
   '{"correct":"Isso: com I e they o verbo fica na forma base.",
     "incorrect":"Com I, you, we e they o verbo fica na forma base; só he, she e it ganham -s.",
     "options":{"a":"Correta: I + forma base (live).","b":"Incorreta: com she o verbo ganha -s (she lives).","c":"Correta: they + forma base (study).","d":"Incorreta: com we o verbo fica na forma base (we study)."}}'::jsonb),
  ('83000000-0000-4000-8000-000000000005', 'ps-3', '{"value":true}'::jsonb,
   '{"correct":"Isso mesmo: com he, o verbo ganha -s (plays).","incorrect":"A frase está correta: com he, she e it o verbo ganha -s, como em he plays."}'::jsonb),
  ('83000000-0000-4000-8000-000000000005', 'order-1', '{"order":["w-i","w-am","w-a","w-student"]}'::jsonb,
   '{"correct":"Ótimo: sujeito + verbo to be + artigo + substantivo.","incorrect":"A ordem é sujeito, verbo to be, artigo e substantivo: I am a student."}'::jsonb),
  ('83000000-0000-4000-8000-000000000006', 'say-1', null, '{}'::jsonb),
  ('83000000-0000-4000-8000-000000000006', 'say-2', null, '{}'::jsonb)
on conflict (practice_activity_id, item_id) do update set
  answer_key = excluded.answer_key,
  feedback = excluded.feedback;

-- P18: explicitly publish canonical seed content after sources/answer keys exist.
do $$
declare t text; r record;
begin
 foreach t in array array['courses','modules','lesson_assets','lessons','materials','practice_activities'] loop
  for r in execute format('select id,to_jsonb(x) data from public.%I x where publication_status=''DRAFT''',t) loop
   begin
    perform private.validate_content(t,r.data);
    execute format('update public.%I set publication_status=''PUBLISHED'',published_at=now() where id=$1',t) using r.id;
   exception when check_violation then raise notice 'Seed % remains DRAFT: unsupported content',r.id;
   end;
  end loop;
 end loop;
end $$;
