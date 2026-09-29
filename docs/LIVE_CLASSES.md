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
