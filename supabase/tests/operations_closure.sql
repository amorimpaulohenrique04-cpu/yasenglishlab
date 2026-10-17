-- PR2 / 2C: incidents (dedupe, lifecycle, evidence), support tickets (ownership), legal docs + consent.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$select ('9d400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlstate=expected then return;else raise;end if;end;
 raise exception 'Expected denial: %',command;
end$$;
create function pg_temp.as_user(n integer,aal text default 'aal2') returns void language sql as $$
 select set_config('request.jwt.claim.sub',pg_temp.id(n)::text,true),set_config('request.jwt.claims',format('{"sub":"%s","aal":"%s"}',pg_temp.id(n),aal),true)$$;
insert into auth.users(id,email) select pg_temp.id(n),'ops-'||n||'@example.test' from generate_series(1,4) n;
insert into public.user_roles(user_id,role) values(pg_temp.id(1),'STUDENT'),(pg_temp.id(2),'ADMIN'),(pg_temp.id(3),'STUDENT'),(pg_temp.id(4),'TEACHER');
insert into public.subscriptions(id,user_id,plan_id,provider,provider_subscription_id,status)
 values(pg_temp.id(10),pg_temp.id(1),'10000000-0000-0000-0000-000000000001','ASAAS','sub_ops_1','PAST_DUE');
insert into public.billing_reconciliation_findings(id,subscription_id,kind) values(pg_temp.id(20),pg_temp.id(10),'PROVIDER_ENDED_LOCAL_ACTIVE');

set local role authenticated;
-- Incidents: only an ADMIN with AAL2 may sync or read.
select pg_temp.as_user(1);
select pg_temp.denied('select public.sync_operational_incidents()');
select pg_temp.as_user(2,'aal1');
select pg_temp.denied('select public.sync_operational_incidents()');
select pg_temp.as_user(2);
select public.sync_operational_incidents();
select pg_temp.assert_true((select count(*)=1 and bool_and(severity='HIGH') from public.operational_incidents where dedupe_key='billing:'||pg_temp.id(20)::text),'billing finding becomes one HIGH incident');
select public.sync_operational_incidents();
select pg_temp.assert_true((select count(*)=1 from public.operational_incidents where dedupe_key='billing:'||pg_temp.id(20)::text and status<>'RESOLVED'),'a second sync does not duplicate it');
select set_config('ops.inc',(select id::text from public.operational_incidents where dedupe_key='billing:'||pg_temp.id(20)::text),true);
select public.acknowledge_operational_incident(current_setting('ops.inc')::uuid);
select pg_temp.assert_true((select status='ACKNOWLEDGED' and assignee_user_id=pg_temp.id(2) from public.operational_incidents where id=current_setting('ops.inc')::uuid),'acknowledge assigns the admin');
select pg_temp.denied(format('select public.resolve_operational_incident(%L,%L)',current_setting('ops.inc'),'ok'),'23514');
select pg_temp.as_user(1);
select pg_temp.assert_true((select count(*)=0 from public.operational_incidents),'student cannot read incidents');
select pg_temp.as_user(2);
reset role;
update public.billing_reconciliation_findings set status='RESOLVED', resolved_at=now(), resolution_note='cleared' where id=pg_temp.id(20);
set local role authenticated;
select pg_temp.as_user(2);
select public.sync_operational_incidents();
select pg_temp.assert_true((select status='RESOLVED' and resolved_by_user_id is null from public.operational_incidents where id=current_setting('ops.inc')::uuid),'a cleared condition closes the incident with system evidence');

-- Support tickets
select pg_temp.as_user(1);
select set_config('ops.ticket',public.open_support_ticket('PAYMENT','Cobrança em aberto','Meu pagamento aparece como pendente há dois dias.')::text,true);
select pg_temp.denied($$select public.open_support_ticket('PAYMENT','x','too short')$$,'23514');
select pg_temp.denied($$select public.open_support_ticket('NOPE','Assunto válido','Descrição suficientemente longa.')$$,'23514');
select pg_temp.assert_true((select count(*)=1 from public.support_tickets),'owner sees the ticket');
select pg_temp.as_user(3);
select pg_temp.assert_true((select count(*)=0 from public.support_tickets),'another student does not');
select pg_temp.denied(format('select public.update_support_ticket(%L,%L,%L)',current_setting('ops.ticket'),'RESOLVED','x'));
select pg_temp.as_user(2);
select pg_temp.assert_true((select count(*)=1 from public.support_tickets),'admin aal2 sees all tickets');
select public.update_support_ticket(current_setting('ops.ticket')::uuid,'IN_PROGRESS','Verificando com o provedor.');
select pg_temp.as_user(1);
select pg_temp.assert_true((select status='IN_PROGRESS' and admin_note is not null from public.support_tickets),'owner sees progress');
-- Bound on unresolved tickets per person.
select public.open_support_ticket('OTHER','Assunto '||g,'Descrição suficientemente longa '||g) from generate_series(1,4) g;
select pg_temp.denied($$select public.open_support_ticket('OTHER','Mais um','Descrição suficientemente longa.')$$,'54000');

-- Legal documents: immutable versions, idempotent consent, no seeded text.
select pg_temp.as_user(1);
select pg_temp.denied($$select public.publish_legal_document('TERMS','1','Termos','texto')$$);
select pg_temp.as_user(2);
select set_config('ops.doc',public.publish_legal_document('TERMS','test-1','Termos de teste','Texto de teste, não é documento jurídico real.')::text,true);
select pg_temp.denied($$select public.publish_legal_document('TERMS','test-1','Termos de teste','Outro texto')$$,'23505');
select pg_temp.as_user(1);
select public.accept_legal_document(current_setting('ops.doc')::uuid,'PROFILE');
select public.accept_legal_document(current_setting('ops.doc')::uuid,'CHECKOUT');
select pg_temp.assert_true((select count(*)=1 and bool_and(context='PROFILE') from public.user_consents),'consent is recorded once with its first context');
select pg_temp.denied(format('update public.legal_documents set body=%L',''),'42501');
reset role;
select pg_temp.denied($$update public.legal_documents set body='changed'$$,'23514');
-- CRM funnel: only a processed CONFIRMED provider event counts as a sale.
insert into public.crm_leads(id,name,source,email,stage,linked_user_id) values
 (pg_temp.id(60),'Lead sold','test','a-sold@example.test','WON',pg_temp.id(1)),(pg_temp.id(61),'Lead won without payment','test','b-won@example.test','WON',pg_temp.id(3)),(pg_temp.id(62),'Lead new','test','c-new@example.test','NEW',null);
insert into public.billing_events(provider,event_id,event_type,subscription_id,payload,occurred_at,processed_at)
 values('ASAAS','evt-funnel-1','CONFIRMED',pg_temp.id(10),'{}',now(),now());
set local role authenticated;
select pg_temp.as_user(1);
select pg_temp.denied('select * from public.admin_crm_funnel()');
select pg_temp.as_user(2,'aal1');
select pg_temp.denied('select * from public.admin_crm_funnel()');
select pg_temp.as_user(2);
select pg_temp.assert_true((select leads>=2 and confirmed_sales>=1 and confirmed_sales<leads from public.admin_crm_funnel() where stage='WON'),'WON counts a sale only when the payment is confirmed');
select pg_temp.assert_true((select confirmed_sales=0 from public.admin_crm_funnel() where stage='NEW'),'unlinked leads are never sales');
reset role;
rollback;
