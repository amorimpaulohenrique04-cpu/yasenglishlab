# Live Classes, Schedule & Booking

## Propósito

Modelar encontros ao vivo, reservas, capacidade e presença como domínio próprio. A Agenda é uma projeção desse domínio.

## Decisões

Tipos:

- `CORE_CLASS`
- `CONVERSATION_LAB`
- `PRIVATE_SESSION`
- `WORKSHOP`

Status:

- `BOOKED`
- `ATTENDED`
- `NO_SHOW`
- `CANCELLED`
- `TEACHER_CANCELLED`

Entidades-base: `live_sessions`, `session_bookings`, `attendance`, `teacher_availability`.
Turmas em grupo: capacidade planejada de até **6 alunos**.
Core = continuidade pedagógica; Lab = uso/speaking temático; Private = acompanhamento individual no Boost.
Provider definitivo de videoconferência permanece aberto; V1 não deve construir WebRTC próprio.

## Invariantes

- Capacidade é aplicada server/database.
- Reserva concorrente não gera overbooking.
- Agenda não é sistema de registro.
- Booking verifica entitlement.
- Presença/no-show são estados explícitos.

## Teacher Operations V1

Teacher Operations V1 é uma superfície operacional restrita, não um Admin CMS. Uma conta precisa possuir a role durável `TEACHER` e atingir AAL2. Dentro de `/teacher`, a identidade do professor sempre deriva de `auth.uid()` → `teachers.user_id`; roles adicionais não ampliam o escopo.

O professor pode:

- listar somente as próprias `live_sessions`;
- ler o roster operacional mínimo somente dessas sessões;
- marcar `ATTENDED` / `NO_SHOW` apenas para `session_bookings.status = 'BOOKED'`.

O roster expõe booking, nome de exibição, status da reserva e attendance. Ele não amplia acesso pedagógico: progresso, assessment e contexto amplo de aluno continuam exigindo `teacher_student_assignments` ativa.

Attendance permanece entidade separada de booking. A escrita ocorre por RPC protegida, reutiliza `UNIQUE(session_booking_id)` e gera audit fact transacional. `NO_SHOW` não cria consequência comercial, crédito, multa, reposição ou cancelamento.

> **Histórico (V1).** Cancelamento/remarcação, meeting provider, disponibilidade editável e autoria estavam fora do V1; disponibilidade, criação de sessão e cancelamento já existem na seção V2 abaixo, que é a fonte atual.

## Teacher Operations V2 / Student Agenda V2

P21.4 extends V1 without turning Teacher into Admin. See [ADR 0012](./adr/0012-provider-neutral-live-operations.md).

- Teacher identity remains derived from `auth.uid()` and all privileged commands require AAL2.
- Teacher availability is durable and serialized; a new/edited session must fit an own interval.
- Group sessions require an authorized active Cohort. Private sessions require one authorized target Student.
- Overlap is rejected in PostgreSQL; adjacent sessions are allowed.
- Existing bookings freeze structural session fields. Rescheduling means cancel + create a new session.
- Student cancel/rebook reuses the existing booking identity and commercial usage snapshot.
- `MANUAL_EXTERNAL` is the provider-neutral V1 meeting mode. Meeting references are server-only.
- Join is authorized at request time. Student requires own BOOKED booking; Teacher requires session ownership + AAL2.
- The initial Join window is 15 minutes before start through 15 minutes after end.
- Agenda keeps an own `BOOKED` session visible through that same Join window after `starts_at`; a session that already started does not become newly bookable.
- Domain notifications are transactional/idempotent state records; no external delivery channel is implied.

## O que não fazer

- `students.length < 6` apenas no navegador.
- Credencial privilegiada de reunião pública.
- Tratar Core e Lab como sinônimos.
- Manter estado do calendário separado da sessão/booking.

## Interfaces

[BILLING.md](./BILLING.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [SECURITY.md](./SECURITY.md) · [OBSERVABILITY.md](./OBSERVABILITY.md)

## Critérios de aceitação

- Concorrência não ultrapassa capacidade.
- Usuário sem entitlement não cria booking indevido.
- Cancelamento/presença/no-show deixam estado durável.
- Meeting access é autorizado.

## P21 foundation closure

The additive P21.1–P21.3 contracts and verification are documented in [P21 foundation](P21_FOUNDATION.md) and ADRs 0007–0009. The prior domain contracts remain applicable.

## Google Meet links (manual mode)

- The Teacher creates the Meet room and pastes the link; the server accepts only `https://meet.google.com/…` links
  and records, in the audit log, whether a save changed the link (never the link itself).
- The link is revealed only through `get_live_session_join_access`, after checking reservation (or Teacher
  ownership), session state and the join window.
- **Limit:** once a Student sees the link, who may enter the room is controlled by Google Meet (host admission,
  Workspace settings). The app does not and cannot guarantee one person per account inside Meet. Teachers should
  turn on host admission in the room.
- Teacher cancellation: every `BOOKED` reservation becomes `TEACHER_CANCELLED`, quota is released per existing
  rules and only those Students get the notice "Esta aula foi cancelada. Nossa equipe entrará em contato para
  informar uma nova data." The cancellation is audited (`TEACHER_SESSION_CANCELLED`, with the affected count).
  No new date is proposed automatically.

## Teacher Sessions workspace redesign

- `/teacher/sessoes` combines Agenda/Week/Month with upcoming/history/cancelled/all filters. History means the scheduled end passed; it never writes `COMPLETED`.
- `get_teacher_session_workspace(from,to,session_id)` is an additive, own-teacher+AAL2 projection. It returns complete interval data without meeting references; existing command RPCs remain authoritative. The JSON envelope avoids row-cap truncation of reports and availability.
- Session creation uses three steps and explicit America/Recife date/time conversion. Booking does not happen implicitly. Existing bookings freeze structural fields; type remains immutable.
- Attendance is available from start, and corrections require the existing reason. Cancellation requires confirmation and the existing transactional command.
- The Meet drawer saves a manually created Google Meet URL, without reading the stored reference. Actual Join authorization remains unchanged.
- Availability suggestions subtract scheduled sessions from durable own intervals. They do not hold a time slot; save revalidates in PostgreSQL.
- Reports count completed sessions only by `COMPLETED`, hours by their planned duration, and attendance by explicit `ATTENDED/(ATTENDED+NO_SHOW)`. Unmarked active bookings in started non-cancelled sessions are pending, never inferred absences.
- Report dates include session starts in America/Recife; cancelled sessions use their scheduled start. Comparisons use the preceding equal-length interval. CSV and private PDF downloads use the same projection and filters, without meeting URLs or student identifiers.
