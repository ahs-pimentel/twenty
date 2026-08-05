# 02 — Inventário das Modificações Existentes no Fork

> **Status:** inventário factual em 2026-08-05.

## 1. Método

Comparação do histórico git local (`origin = ahs-pimentel/twenty`) contra o último commit herdado do upstream (`538b1808`, `twentyhq/twenty`, 2026-06-27). O clone **não possui remote `upstream` configurado**; a comparação usa o próprio histórico linear, que é inequívoco porque toda a divergência está em commits posteriores a `538b1808`.

```text
538b1808  feat(dpa): ... (#22243)            ← último commit do upstream
18114171  docs(specs): proposal module        ← óDois
8a532be9  docs(specs): o2d-ai-platform        ← óDois
3283a859  merge PR #1                         ← óDois (main atual)
```

## 2. Diff completo fork × upstream

| Categoria | Arquivos | Classificação |
|---|---|---|
| **Adicionados** | `docs/specs/proposal-module/**` (17 arquivos), `docs/specs/ai-hub-module/**` (26 arquivos) | documentação (specs proprietárias óDois) |
| **Modificados** | nenhum | — |
| **Removidos** | nenhum | — |

Verificações específicas exigidas pela missão, todas **negativas**:

| Item verificado | Resultado |
|---|---|
| Componentes substituídos | nenhum |
| Tokens alterados | nenhum (`theme-light.css`/`theme-dark.css` intactos) |
| Cores hardcoded adicionadas | nenhuma |
| Logos inseridos | nenhum (nenhum asset óDois no repositório) |
| Textos alterados | nenhum |
| Imports de assets próprios | nenhum |
| Mudanças na tela de login | nenhuma |
| Mudanças de navegação | nenhuma |
| Mudanças em temas / `ThemeProvider` | nenhuma |
| Mudanças no Storybook | nenhuma |
| Mudanças nos pipelines (`.github/workflows`) | nenhuma |
| Mudanças no Docker (`packages/twenty-docker`) | nenhuma |

## 3. Classificação das alterações existentes

Única classe presente: **documentação/especificação** (não é branding, funcionalidade, correção, infraestrutura, integração nem dívida técnica — é material de planejamento óDois).

| Caminho | Responsabilidade | Risco | Migrável para o Branding Engine? | Impacto em atualização do upstream |
|---|---|---|---|---|
| `docs/specs/proposal-module/` | Spec do módulo de propostas (WhatsApp/LLM/CRM) | nenhum (docs) | n/a | zero — o upstream não toca `docs/specs/` |
| `docs/specs/ai-hub-module/` | Spec da plataforma de IA o2d | nenhum (docs) | n/a | zero |

**Não existe nenhuma alteração de branding a migrar.** O fork está no estado ideal para iniciar o Branding Engine: divergência zero em código.

## 4. Consequências

1. **Baseline limpa**: qualquer futura divergência de código nasce já sob a disciplina desta spec (patches finos, doc 22), sem passivo a converter.
2. **Upstream bridge parte do zero real** (doc 21): a primeira sincronização será trivial; o processo deve ser instaurado *antes* da primeira alteração de código do fork, não depois.
3. **Pontos de maior divergência com o upstream (projeção)**: quando o Branding Engine for implementado, os pontos de contato previstos com código do core são os enumerados no doc 17 da missão → doc 03 (mapa de impacto) e doc 22 (patches): `index.html`, `AppRouterProviders.tsx`, `title-utils.ts`, constantes `DefaultWorkspace*`, `twenty-emails/src/components/{Logo,Footer}.tsx`, `manifest.json`. Tudo o mais deve viver em pacotes novos `o2d-*`.
4. A identidade visual e os assets da óDois **ainda não estão no repositório** — a introdução deles deve seguir o modelo de propriedade do doc 24 (assets proprietários fora do escopo AGPL, servidos como configuração/dados, não commitados no core).
