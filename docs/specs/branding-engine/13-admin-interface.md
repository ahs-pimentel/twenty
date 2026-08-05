# 13 — Interface Administrativa

> **Status:** proposta — nada implementado. Árvore de navegação e comportamentos funcionais no doc 04 §4; aqui: implementação, permissões por seção e estados.

## 1. Veículo de instalação

**Preferência: Twenty App óDois** (`o2d-branding-admin`), usando as capacidades já existentes da plataforma de Apps (evidência doc 00 §2: apps contribuem `navigation-menu-items`, `page-layouts`, `front-components`, `roles`, `logic-functions`):

- Item de navegação em Configurações → "Identidade visual".
- Telas como front-components (renderizadas pelo `twenty-front-component-renderer` — sandbox remote-dom com `ThemeProvider` próprio, evidência doc 00 §2).
- Permissões via roles/permission-flags do App.

**Limitações a validar (OQ-13-1)**: o manifesto atual marca `settingsCustomTabFrontComponentUniversalIdentifier` como **deprecated** ("Custom settings tabs are no longer supported" — `twenty-shared/src/application/applicationType.ts:24-29`). Se a plataforma não permitir páginas plenas em Configurações, fallback: rota de settings adicionada por patch fino P7 (doc 22) com componentes hospedados no pacote `o2d-branding-front` (o patch é só o registro da rota).

## 2. Permissões por seção (matriz completa no doc 17)

| Seção | Nível 1 (admin) | Nível 2 (admin técnico) | Nível 3 (mantenedor óDois) |
|---|---|---|---|
| Visão geral | leitura | leitura | leitura |
| Marca, Cores, Interface, Sidebar, Temas | edição (tokens seguros) | edição | edição |
| Tipografia, Login (avançado), E-mails, Documentos | leitura | edição | edição |
| Assets | upload nos slots seguros | todos os slots | todos + fallbacks da distribuição |
| Versões | leitura | leitura + restaurar (gera rascunho) | tudo |
| Publicação | salvar rascunho, visualizar, validar | + publicar, rollback (se tiver flag de publicação) | tudo |
| Configurações da distribuição (adapters, patches, presets globais) | invisível | invisível | fora da UI de workspace — via repositório/deploy |

## 3. Comportamentos de edição

- **Rascunho único por configuração** (MVP): editar cria/atualiza o rascunho corrente; "Descartar alterações" retorna ao snapshot publicado. Múltiplos rascunhos nomeados = evolução futura.
- **Validação contínua leve** (cliente, usando o core compartilhado): contraste e limites mostrados ao digitar; validação completa (server) no botão "Validar" e antes de publicar.
- **Visualização clara/escura lado a lado** na seção Cores (usa `ThemeProvider` escopado com `overrides` — doc 14).
- **Cores derivadas** exibidas como somente leitura com origem ("derivada de brand.primary"); editar exige Nível 2 e quebra o vínculo explicitamente.
- **Assets**: estados `processando → válido | rejeitado (motivo)`; slot mostra a cadeia de fallback efetiva.
- **Publicação**: resumo do diff (tokens alterados, assets trocados), resultado da validação, aviso de impacto ("afeta N domínios"), confirmação explícita. Após publicar: link para rollback.
- **Concorrência**: lock otimista por `updatedAt` do rascunho; conflito → recarregar com diff.

## 4. Visão geral (conteúdo mínimo)

Status da configuração (estado da máquina doc 15); versão publicada + hash; última alteração (autor/data); domínios servidos por esta configuração; compatibilidade do adapter (`CompatibilityResult` resumido); alertas: contraste em aviso, assets ausentes/em fallback, rascunho não publicado há N dias.

## 5. Restrições de UI

- Nenhum campo de CSS livre, nenhum campo de URL externa, nenhum upload de fonte (doc 04 §3, §6).
- Textos (nome do produto, títulos de login, mensagem legal) são texto puro — renderizados sem HTML.
- A UI nunca exibe valores `--t-*` reais ao cliente (só nomes abstratos) — evita acoplamento do cliente ao contrato interno do Twenty.
