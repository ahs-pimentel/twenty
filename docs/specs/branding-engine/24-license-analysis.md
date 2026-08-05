# 24 — Análise de Licença e Propriedade Intelectual

> **Status:** análise técnica com base nos arquivos de licença reais do repositório. **Não é parecer jurídico**; os pontos de decisão estão em §7 e exigem revisão jurídica formal.

## 1. Licenças reais encontradas (evidência)

| Arquivo | Conteúdo |
|---|---|
| `LICENSE` (raiz) | **AGPL-3.0** com preâmbulo de exceção: arquivos marcados `/* @license Enterprise */` estão sob **licença comercial** definida no mesmo arquivo, não sob AGPL |
| `packages/twenty-ui/LICENSE` | idêntico ao da raiz (AGPL-3.0 + exceção Enterprise) |
| `packages/twenty-companion/LICENSE` | **MIT-style**, Copyright 2025 Recall.ai |
| `package.json` raiz | `"license": "AGPL-3.0"`; `twenty-server`, `twenty-front`, `twenty-front-component-renderer` declaram `AGPL-3.0` |

Arquivos Enterprise: **299 arquivos** com o marcador (242 em `twenty-server`, 52 em `twenty-front`, 5 em `twenty-shared`); não há diretório `ee/`. Clusters relevantes ao branding: **custom domain no front** (`packages/twenty-front/src/modules/settings/domains/components/SettingsCustomDomain.tsx`, `useSettingsCustomDomain.ts`, `CheckCustomDomainValidRecordsEffect.tsx`), SSO, row-level permissions (`twenty-shared/src/types/RowLevelPermissionPredicate*.ts`), usage. Além disso, o custom domain é **gated por entitlement de billing** (`BillingEntitlementKey.CUSTOM_DOMAIN`, `custom-domain-manager.service.ts:36-49`) — restrição *funcional* além da licença.

## 2. Classificação das partes do Branding Engine

| Parte | Natureza | Regime proposto |
|---|---|---|
| Patches nos arquivos AGPL do core (série P1–P10, doc 22) | modificação direta do Twenty | **AGPL-3.0** — obrigação de disponibilizar fonte a usuários de rede (ver §4) |
| Módulo server `src/o2d/branding/**` dentro do `twenty-server` | código novo, mas **combinado/derivado** do twenty-server (mesmo processo, imports NestJS do engine) | tratar como **AGPL** por prudência (posição conservadora); separação em serviço próprio mudaria a análise — decisão jurídica §7 |
| Pacotes `o2d-branding-core`, `o2d-branding-adapters` (TS puro, sem imports do Twenty) | código independente | podem ser **proprietários** se mantidos como obras separadas; adapters referenciam apenas *nomes* de tokens — manter livres de código copiado do Twenty |
| `o2d-branding-front` (importa componentes twenty-ui AGPL) | combinado com AGPL no bundle do front | tratar como AGPL por prudência (mesma lógica do módulo server) |
| **Configurações e presets** (JSON de tokens) | dados, não código | proprietários da óDois / do cliente |
| **Assets óDois** (logos, favicons, imagens) e **design system óDois** | marca e obra autoral da óDois | **propriedade da óDois**; distribuídos como dados/configuração, **não commitados no core**; uso licenciado aos clientes por contrato |
| Assets de clientes | propriedade dos clientes | processados/armazenados sob contrato (LGPD — doc 17 §4) |
| Templates de e-mail modificados (`twenty-emails`, sem LICENSE próprio → AGPL da raiz) | modificação | AGPL |
| Specs (`docs/specs/branding-engine/**`) | documentação óDois | proprietária (como os pacotes de specs anteriores) |

## 3. Riscos de uso de marca

- "Twenty" é marca do Twenty PBC (`Footer.tsx` referencia "Twenty.com, Public Benefit Corporation"). A licença AGPL **não** concede direitos de marca. A distribuição óDois deve: remover/substituir marca Twenty nas superfícies voltadas ao usuário (é exatamente o que o engine faz), **manter avisos de copyright e licença no código** (obrigação de atribuição — não confundir remoção de marca visual com remoção de notices), e não sugerir endosso pelo Twenty.
- O logo default remoto (`twentyhq.github.io/.../twenty-logo.png`) e ícones `twenty-star.svg` são identidade do Twenty — o engine os substitui por assets óDois via fallback da distribuição, sem apagar os arquivos do upstream (evita conflito de merge e preserva notices).
- Repositório de docs do Twenty menciona diretrizes próprias; verificar documento de trademark oficial do projeto (não presente neste repositório) — item para §7.

## 4. Obrigações AGPL por modo de uso

| Modo | Obrigação prática |
|---|---|
| Uso interno óDois (rede própria) | AGPL §13: usuários interagindo pela rede têm direito ao fonte da versão modificada — política mais simples: manter o fork público (ou oferta de fonte equivalente) |
| Oferta SaaS a clientes | mesma obrigação, agora perante os usuários dos clientes; o fonte a disponibilizar = Twenty + patches + partes combinadas (análise §2); partes separadas proprietárias (core/adapters como obras independentes, configurações, assets) ficam fora — **fronteira exata é decisão jurídica** |
| Distribuição on-premise a clientes | distribuição clássica: fonte AGPL acompanha o binário; termos óDois cobrem só as partes proprietárias e a marca |

Arquivos `/* @license Enterprise */`: usá-los (custom domain UI, SSO) **exige licença comercial do Twenty** (a exceção do LICENSE os retira do AGPL). Impacto direto: **branding por domínio custom (Fase 5) depende de posição comercial** — alternativas: (a) licença enterprise do Twenty, (b) resolução de domínio própria da óDois sem tocar os arquivos Enterprise (o engine consome apenas o serviço de resolução de host, que está no server AGPL — `workspace-domains.service.ts` **não** tem o marcador; verificado), (c) limitar Fase 5 a subdomínios.

## 5. Pacotes com licença distinta

- `twenty-companion` (MIT/Recall.ai): fora do escopo do engine; sem impacto.
- Dependências de terceiros (Radix colors, react-helmet fork, etc.): licenças permissivas típicas; auditoria automatizada de licenças (SPDX scan) proposta como teste de CI (doc 26 Fase 1 e "testes de licenciamento de pacotes" da Etapa 30).
- **Fontes**: Inter e DM Mono chegam por Google Fonts CDN (`index.html:31-38`); ao auto-hospedar (doc 04 §3), respeitar as licenças das fontes (Inter = SIL OFL — permite self-host; confirmar cada fonte do catálogo curado). **Não compartilhar arquivos de fonte encontrados no ambiente** — o catálogo é construído a partir de fontes obtidas das fontes oficiais com licença verificada.

## 6. Síntese de obrigações

1. Atribuição: preservar copyright/notices do Twenty em todo código AGPL e Enterprise-marcado.
2. Disponibilização de fonte: fork + patches + partes combinadas, conforme modo de uso (§4).
3. Marca: substituição visual sem remoção de notices; sem uso da marca Twenty na comunicação da distribuição além do factual ("baseado em Twenty CRM").
4. Assets/identidade óDois: propriedade óDois; jamais versionados sob AGPL (entregues como dados).
5. Enterprise files: não usar sem posição comercial definida.

## 7. Pontos que exigem revisão jurídica (obrigatória antes da implementação)

| ID | Questão |
|---|---|
| JUR-1 | Fronteira exata AGPL × proprietário para módulo server e front do engine (obra combinada vs. separada; alternativa de serviço externo) |
| JUR-2 | Uso dos arquivos `/* @license Enterprise */` (custom domain UI, SSO): licenciar com o Twenty, reimplementar, ou restringir escopo |
| JUR-3 | Política de disponibilização de fonte para SaaS multi-cliente (forma da oferta: repositório público? oferta escrita?) |
| JUR-4 | Diretrizes de trademark do Twenty aplicáveis à distribuição renomeada |
| JUR-5 | Termos com clientes sobre assets/branding de sua propriedade (upload, uso, remoção, LGPD) |
| JUR-6 | Licenças das fontes do catálogo curado para self-host e redistribuição |
