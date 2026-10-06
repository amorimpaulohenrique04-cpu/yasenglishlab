# Plano — 3E Notification Delivery

1. ADR Resend e migration aditiva: prova de evento aplicado pelo mirror e audit; dedupe/outbox; RPCs service-only com claim SKIP LOCKED e fencing.
2. Port, templates V1, Resend/Fake, recipient Auth e processor bounded; retries seguros e sem scheduler.
3. Checks focados, SQL/RLS e concorrência; PR/Official CI; fechamento e merge. Não iniciar 3F.
