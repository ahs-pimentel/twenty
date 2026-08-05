# 16 — Acessibilidade

> **Status:** especificação proposta — nenhum código implementado.
> Escopo: garantir que nenhuma personalização administrativa do Branding Engine possa tornar a distribuição inacessível.

## 1. Princípio

Branding é um **conjunto restrito de graus de liberdade sobre um design system acessível**. O Twenty upstream é a baseline; o Branding Engine só aceita valores que preservem os invariantes abaixo. Acessibilidade é tratada como **validação bloqueante de publicação** (estado `VALIDATION_FAILED`, doc 15), não como recomendação.

## 2. Invariantes obrigatórios (bloqueiam publicação)

| # | Invariante | Referência WCAG | Verificação |
|---|---|---|---|
| A1 | Contraste texto normal ≥ 4.5:1 (`text.primary`/`text.secondary` sobre `background.*` e `surface.*`) | 1.4.3 AA | cálculo automático sobre todos os pares token-fundo usados |
| A2 | Contraste texto grande e componentes de UI ≥ 3:1 (`brand.onPrimary` sobre `brand.primary`, bordas de inputs, ícones informativos) | 1.4.3 / 1.4.11 AA | idem |
| A3 | `border.focus` (anel de foco) contraste ≥ 3:1 contra fundo adjacente; foco nunca pode ser removido (token somente leitura para `outline: none`) | 2.4.7 / 1.4.11 | par `border.focus` × `background.primary` |
| A4 | Tamanho mínimo de fonte: `font.size.xs` ≥ 0.75rem; escala tipográfica não pode reduzir nenhum degrau abaixo do piso | 1.4.4 | limites min/max por token no schema (doc 14) |
| A5 | Estados hover/active/disabled derivados mantêm distinção perceptível (ΔL* mínimo em OKLCH entre estado base e hover) | 1.4.1 | função de derivação (doc 09 §2.3) valida a distância |
| A6 | Ambos os modos (light e dark) passam A1–A5 — publicar exige os dois modos válidos | — | validação executa 2× |
| A7 | Distinção além de cor: tokens `status.*` não podem colapsar em valores indistinguíveis entre si (ΔE mínimo par a par) | 1.4.1 | matriz de distância entre os 4 status |

## 3. Invariantes garantidos por restrição de escopo (não configuráveis)

Estes pontos permanecem sob controle do Twenty/óDois e **fora do alcance de qualquer configuração cliente**, por construção (tiers "somente leitura", doc 09 §2.3):

- **Navegação por teclado e ordem de foco** — branding não altera DOM, roteamento ou tabindex.
- **Leitores de tela** — branding não injeta/remoque `aria-*`; textos configuráveis (nome do produto, títulos de login) são texto puro sanitizado, sem HTML.
- **Redução de movimento** — tokens de animação (`--t-animation-*`) são somente leitura; o respeito a `prefers-reduced-motion` permanece o do upstream.
- **Z-index e sobreposição** — `--t-lastLayerZIndex`, camadas de modal e overlays não são expostos (impede ocultar modais, avisos legais e diálogos de permissão — requisito de segurança, doc 17).
- **Avisos legais, telas de permissão e ações críticas** — nenhum token permite `display`, `visibility`, `opacity` ou posicionamento; branding não pode ocultá-los (cenário de teste obrigatório 19, doc 23).

## 4. Comportamento da validação

- **Erro (bloqueia)**: violação de A1–A7. Resposta da validação lista cada par reprovado com valores medidos e o mínimo exigido, por modo (light/dark).
- **Aviso (não bloqueia)**: contraste entre 4.5:1 e 7:1 para texto normal (AA ok, AAA não), fontes customizadas sem fallback métrico próximo, `radius.pill` em inputs (risco estético, não de acesso).
- **Auto-correção assistida (opcional na UI)**: para A1/A2, a tela de cores sugere o valor válido mais próximo (ajuste de luminosidade preservando matiz) — sugestão explícita, nunca aplicada silenciosamente.

## 5. Pontos de atenção específicos do Twenty

- A cor de marca vira **escala 1–12** (doc 09 §2.4); os degraus 9 (sólido) e 11 (texto) têm exigências de contraste diferentes — a geração de escala já embute A1/A2 por degrau.
- `font.color.tertiary/light/extraLight` do Twenty (`packages/twenty-ui/src/theme/constants/FontLight.ts`) têm contraste propositalmente baixo (texto auxiliar). O mapeamento abstrato → real (adapter) não deve permitir que `text.muted` seja usado onde o upstream usa `text.primary`.
- Dark mode: `theme-dark.css` inverte escalas de cinza; a validação roda sobre os valores finais pós-adapter, não sobre o modelo abstrato, para capturar erros de mapeamento.

## 6. Testes (ver doc 23)

- Testes unitários da função de contraste e da derivação de estados (tabela de casos com valores-limite).
- Testes de regressão visual light/dark para os cenários com estados de foco visíveis.
- Cenário obrigatório 13 (doc 30 da missão): "tema claro e escuro mantêm contraste aceitável" — implementado como suite que valida `preset.odois` e presets de exemplo contra A1–A7.
- Auditoria automatizada (axe-core ou equivalente já disponível no repositório — a verificar no inventário, doc 00) executada nos cenários de preview.
