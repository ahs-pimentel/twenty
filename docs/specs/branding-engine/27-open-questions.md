# 27 — Perguntas em Aberto (exigem decisão humana)

> Nenhum item abaixo é decisão tomada. Sugestões marcadas como "default proposto" só valem após aprovação explícita.

## Arquitetura e produto

| ID | Pergunta | Opções / default proposto |
|---|---|---|
| OQ-08-1 | Servir `index.html` com bloco inline **por domínio** (requer servir HTML dinamicamente) ou aceitar inline apenas da distribuição na 1ª visita multi-tenant? | Default: inline da distribuição + cache local (doc 08 §4); reavaliar na Fase 5 |
| OQ-12-1 | Acrescentar `brandingHash`/`branding` à `PublicWorkspaceDataDTO` (patch P9) ou manter endpoint REST separado? | Default: endpoint separado no MVP; decidir na Fase 5 |
| OQ-13-1 | Admin UI como Twenty App é viável para páginas de Configurações? (`settingsCustomTabFrontComponentUniversalIdentifier` está deprecated — evidência doc 13 §1) | Validar com spike na Fase 3; fallback: patch P7 (rota) |
| OQ-19-1 | Superfície admin em GraphQL (padrão do Twenty) ou REST? | Default: GraphQL admin + REST público |
| OQ-04-1 | Multi-configuração por workspace no MVP (N configs + domínios apontando) ou 1 config por workspace? | Default: modelo de dados suporta N; UI expõe 1 no MVP |

## Tokens

| ID | Pergunta | Default proposto |
|---|---|---|
| OQ-09-1 | Gerar escala 1–12 própria a partir de `brand.primary` ou restringir à troca entre as 24 cores Radix já embarcadas? | Escala gerada (flexibilidade white-label); spike de qualidade visual antes de congelar |
| OQ-09-2 | Expor `spacing.unit`/densidade no Nível 2 já na Fase 3? | Não — somente leitura até haver matriz visual de densidade (Fase 4+) |
| OQ-09-3 | `font.family.heading` separado do body? | Não no MVP (Twenty usa família única — `FontCommon.ts:16`) |

## Jurídico (bloqueantes por fase — detalhe no doc 24 §7)

| ID | Pergunta | Bloqueia |
|---|---|---|
| JUR-1 | Fronteira AGPL × proprietário (módulo server/front do engine) | Fase 3 (estrutura de repositório/publicação) |
| JUR-2 | Uso dos arquivos `/* @license Enterprise */` (custom domain UI/SSO): licenciar, reimplementar ou restringir a subdomínios | Fase 5 |
| JUR-3 | Forma da disponibilização de fonte AGPL no SaaS | Go-live comercial |
| JUR-4 | Diretrizes de trademark do Twenty para a distribuição renomeada | Fase 2 |
| JUR-5 | Termos com clientes sobre assets próprios (upload/uso/remoção/LGPD) | Fase 3 (upload de assets de cliente) |
| JUR-6 | Licenças das fontes do catálogo curado (self-host/redistribuição) | Fase 2 (fontes auto-hospedadas) |

## Operação

| ID | Pergunta | Default proposto |
|---|---|---|
| OQ-21-1 | Sync por merge ou rebase na integração com upstream? | Merge em `o2d/integration` + série de patches rebased (histórico auditável) |
| OQ-21-2 | Cadência de sync com upstream | Semanal automatizado até relatório; homologação sob demanda |
| OQ-17-1 | Flag de permissão dedicado `BRANDING` desde o MVP ou reuso de `WORKSPACE`? | Reuso no MVP; flag dedicado na Fase 4 |
| OQ-25-1 | CDN desde a Fase 3 ou somente na Fase 5? | Fase 5 (hash-based já é CDN-ready) |
| OQ-11-1 | Retenção de assets órfãos (GC) — prazo | 90 dias (proposta doc 11 §4) |

## Escopo

| ID | Pergunta |
|---|---|
| OQ-04-2 | Documentos gerados (Fase 7): quais documentos existem/existirão na distribuição para receber branding? (o repositório atual tem o gerador de DPA — `feat(dpa)` no commit base — como primeiro candidato) |
| OQ-04-3 | Presets por cliente: gerenciados pela óDois (serviço) ou self-service dos clientes? |
