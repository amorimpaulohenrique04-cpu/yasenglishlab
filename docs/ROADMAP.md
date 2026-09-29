# Roadmap

## Propósito
Ordenar implementação por dependências para reduzir retrabalho. Infraestrutura e sistemas de registro vêm antes das telas agregadoras.

## Decisões
Ordem planejada:
- **P0:** requisitos + design system + arquitetura.
- **P1:** repository foundation + CI + ambientes.
- **P2:** Auth + Profile + Roles + RLS.
- **P3:** AppShell responsivo.
- **P4:** Courses + Modules + Lessons.
- **P5:** Aulas.
- **P6:** Home.
- **P7:** Materiais.
- **P8:** Prática.
- **P9:** Agenda + encontros ao vivo.
- **P10:** Progresso.
- **P11:** Teste de Proficiência.
- **P12:** Billing + planos.
- **P13:** Teacher portal.
- **P14:** Admin.
- **P15:** Analytics + observability.
- **P16:** security hardening.
- **P17:** accessibility + performance.
- **P18:** beta fechado.
- **P19:** produção.

## Invariantes
- Home vem depois dos domínios que ela agrega.
- Cada fase fecha implementação, teste, evidência e checkpoint antes da próxima.
- Fase posterior não reabre decisão estrutural silenciosamente.
- Segurança e acessibilidade são contínuas, mesmo que existam fases de hardening.

## O que não fazer
- Pedir a um coding agent “faça o portal inteiro”.
- Construir Home com mocks permanentes antes do domínio.
- Adiar toda autorização para P16.
- Avançar com blocker estrutural não registrado.

## Interfaces
[ARCHITECTURE.md](./ARCHITECTURE.md) · [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md) · [TESTING.md](./TESTING.md) · [OPERATIONS.md](./OPERATIONS.md)

## Critérios de aceitação
- Toda fase possui dependências conhecidas.
- Estado/decisões são persistidos entre fases.
- Uma fase pode ser verificada de forma independente.
