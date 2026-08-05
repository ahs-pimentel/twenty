# 05 — Modelo de Dados

> **Arquitetura proposta** (não implementada). Divisão de fonte da verdade conforme `04-technical-spec.md` §7:
> **Twenty (objetos do App óDois)** = dados comerciais visíveis/editáveis sob RBAC; **PostgreSQL do Serviço de Propostas** = dados técnicos imutáveis (versões, hashes, aprovações, mensagens, eventos). Sem duplicação: espelhos carregam apenas referências (IDs/URLs) e `syncedAt`.

## 1. Diagrama ER (visão lógica unificada)

```mermaid
erDiagram
    COMPANY ||--o{ PROPOSAL : "cliente"
    PERSON ||--o{ PROPOSAL : "contato"
    OPPORTUNITY o|--o{ PROPOSAL : "origem/destino"
    WORKSPACE_MEMBER ||--o{ PROPOSAL : "responsável"
    PROPOSAL ||--|{ PROPOSAL_ITEM : "itens"
    SERVICE_CATALOG_ITEM o|--o{ PROPOSAL_ITEM : "referencia"
    PROPOSAL_TEMPLATE o|--o{ PROPOSAL : "template"
    PROPOSAL ||--o{ PROPOSAL_VERSION : "versões (serviço)"
    PROPOSAL_VERSION ||--o{ PROPOSAL_APPROVAL : "aprovações (serviço)"
    PROPOSAL ||--o{ PROPOSAL_SOURCE_MESSAGE : "mensagens (serviço)"
    PROPOSAL ||--o{ PROPOSAL_EVENT : "eventos (serviço)"
    PROPOSAL_VERSION o|--o{ DOCUMENT_ARTIFACT : "prévia/final (serviço)"
    EVOLUTION_INSTANCE ||--o{ PROPOSAL_SOURCE_MESSAGE : "instância (serviço)"
    EVOLUTION_INSTANCE ||--o{ WA_SESSION : "sessões (serviço)"
    WA_SESSION o|--o{ PROPOSAL : "conversa→proposta (serviço)"

    PROPOSAL {
        uuid id PK
        string number UK "PRO-2026-0001"
        string title
        select status "21 estados (07)"
        select origin "WHATSAPP|MANUAL|MCP"
        uuid companyId FK
        uuid contactId FK
        uuid opportunityId FK "nullable"
        uuid ownerId FK
        text description
        richtext scope
        currency subtotal "amountMicros+currencyCode"
        currency discount
        currency total
        date validUntil
        string deliveryTime
        text paymentTerms
        int currentVersionNumber "espelho"
        int approvedVersionNumber "espelho, nullable"
        string approvedSnapshotHash "espelho, read-only"
        string finalDocumentHash "espelho, read-only"
        string previewDocumentUrl "URL assinada"
        string finalDocumentUrl "URL assinada"
        number confidenceScore "0..1"
        string recipientPhone "E.164"
        datetime recipientValidatedAt
        datetime sentAt
        datetime viewedAt
        datetime acceptedAt
    }
    PROPOSAL_ITEM {
        uuid id PK
        uuid proposalId FK
        uuid catalogItemId FK "nullable"
        string description
        number quantity
        string unit "hora|mês|projeto|un"
        currency unitPrice
        number discountPercent
        currency total
        boolean isOptional
        position order
        text notes
    }
    SERVICE_CATALOG_ITEM {
        uuid id PK
        string code UK
        string name
        select category
        text description
        string unit
        currency basePrice
        currency minPrice
        number minMarginPercent
        string defaultDuration
        boolean requiresApproval
        boolean isActive
    }
    PROPOSAL_TEMPLATE {
        uuid id PK
        string name
        select category
        int version
        string storageKey "arquivo no storage do serviço"
        rawjson configuration
        boolean isActive
        rawjson requiredSections
    }
    PROPOSAL_VERSION {
        uuid id PK
        uuid proposalId FK
        int versionNumber UK "por proposta"
        jsonb snapshot "JSON canônico completo"
        jsonb diffFromPrevious
        text changeReason
        string createdByActor "usuário|sistema|LLM(assistido)"
        timestamptz createdAt
        uuid previewArtifactId FK
        string snapshotHash "sha256, imutável"
    }
    PROPOSAL_APPROVAL {
        uuid id PK
        uuid proposalId FK
        uuid versionId FK
        string approverUserId "usuário Twenty"
        string requestedByUserId
        enum decision "PENDING|APPROVED|REJECTED|CHANGES_REQUESTED|INVALIDATED"
        text comment
        timestamptz requestedAt
        timestamptz decidedAt
        string approvedSnapshotHash
        enum method "TWENTY_UI|MCP_CONFIRMED"
        inet ipAddress
        jsonb authContext "tipo token, sessão, 2FA"
    }
    PROPOSAL_SOURCE_MESSAGE {
        uuid id PK
        uuid proposalId FK "nullable até vincular"
        uuid instanceId FK
        string messageId UK "com instanceId"
        string phone
        string senderName
        enum type "TEXT|AUDIO|IMAGE|DOCUMENT|STATUS"
        text content
        text transcription "F3"
        string attachmentKey "storage"
        timestamptz receivedAt
        enum processingStatus "RECEIVED|QUEUED|PROCESSED|FAILED|IGNORED"
    }
    PROPOSAL_EVENT {
        bigint id PK
        uuid proposalId FK
        uuid versionId FK "nullable"
        string type "proposal.* (06)"
        string actor "user:...|system|agent:...|integration:..."
        enum origin "UI|WEBHOOK|WORKER|MCP|SYSTEM"
        jsonb payload
        timestamptz occurredAt
        uuid correlationId
        uuid causationId
    }
    DOCUMENT_ARTIFACT {
        uuid id PK
        uuid proposalId FK
        uuid versionId FK
        enum kind "PREVIEW|FINAL"
        string storageKey UK
        string sha256
        int sizeBytes
        string mimeType "application/pdf"
        timestamptz createdAt
    }
    EVOLUTION_INSTANCE {
        uuid id PK
        string name UK
        string baseUrl
        bytea apiKeyEncrypted
        bytea webhookSecretEncrypted
        string phoneNumber
        enum status "CONNECTED|DISCONNECTED|DISABLED"
    }
    WA_SESSION {
        uuid id PK
        uuid instanceId FK
        string phone
        enum state "IDLE|COLLECTING|AWAITING_ANSWER"
        uuid activeProposalId FK "nullable"
        timestamptz windowExpiresAt
        jsonb pendingQuestions
    }
```

## 2. Objetos no Twenty (App óDois)

Criados via `defineObject`/`defineField` (`packages/twenty-sdk/src/sdk/define/`); tipos de campo do enum real `FieldMetadataType` (`packages/twenty-shared/src/types/FieldMetadataType.ts`). Valores monetários usam o composite `CURRENCY` (`amountMicros` + `currencyCode` — `packages/twenty-shared/src/types/composite-types/currency.composite-type.ts`), como o `opportunity.amount` padrão.

### 2.1 `proposal`
Campos conforme ER acima. Observações normativas:
- `status`: `SELECT` com os 21 estados canônicos; **read-only para usuários** via `fieldPermission` (editável apenas pela API key da integração) — a autoridade é a máquina de estados do serviço.
- `number`: sequência gerada pelo serviço (`PRO-{ano}-{seq}`), única por workspace.
- Campos espelho (`approvedSnapshotHash`, `finalDocumentHash`, `currentVersionNumber`, `approvedVersionNumber`, URLs de documentos): read-only; fonte no serviço.
- Relações: `company` (cliente), `person` (contato), `opportunity` (opcional), `workspaceMember` (responsável) — `RELATION` com `OnDeleteAction` restritiva para company/person (proposta não órfã).
- `searchVector`/timeline/attachments herdados do padrão de objetos do Twenty.

### 2.2 `proposalItem`
Relação N:1 com `proposal` (cascade delete lógico junto com a proposta) e N:1 opcional com `serviceCatalogItem`. `total` é **calculado pelo serviço** (quantidade × unitário − desconto) e gravado; a UI não recalcula com regra própria. `order` usa `POSITION` (drag-and-drop nativo das listas do Twenty).

### 2.3 `serviceCatalogItem`
Cadastro administrado (role `proposal-admin`). `minPrice`/`minMarginPercent` alimentam as validações determinísticas de precificação do serviço; `requiresApproval` marca itens que sempre exigem atenção do aprovador (destacados na revisão).

### 2.4 `proposalTemplate`
Metadados do template; o arquivo (HTML/estrutura) vive no storage do serviço (`storageKey`) e é **versionado** — cada `ProposalVersion.snapshot` referencia `templateId + templateVersion`, congelando a aparência da versão.

## 3. Tabelas no PostgreSQL do Serviço

Todas com `createdAt`/`updatedAt`; as marcadas **append-only** não recebem UPDATE/DELETE em operação normal (constraint por trigger de banco + revogação de privilégios do usuário da aplicação).

| Tabela | Append-only | Índices/constraints principais |
|---|---|---|
| `proposal_ref` (id da proposta ↔ id do registro Twenty, workspace, número) | não | UK `(workspaceId, twentyRecordId)`, UK `number` |
| `proposal_version` | **sim** | UK `(proposalId, versionNumber)`; `snapshotHash` NOT NULL; GIN em `snapshot` p/ diff |
| `proposal_approval` | **sim** (decisão gravada uma vez; invalidação = novo registro com `decision=INVALIDATED` referenciando o anterior) | IDX `(proposalId, decidedAt)`; FK `versionId` NOT NULL |
| `proposal_source_message` | sim | **UK `(instanceId, messageId)`** — deduplicação de webhook; IDX `(phone, receivedAt)` |
| `proposal_event` | **sim** | IDX `(proposalId, occurredAt)`, `(correlationId)`, `(type)`; particionamento por mês a partir de volume |
| `document_artifact` | **sim** | UK `storageKey`; IDX `(proposalId, kind)`; `kind=FINAL` único por `versionId` |
| `evolution_instance` | não | UK `name`; segredos cifrados (AES-GCM com chave de aplicação) |
| `wa_session` | não | UK `(instanceId, phone)`; TTL lógico via `windowExpiresAt` |
| `idempotency_key` | sim (expira por TTL) | UK `(scope, key)`; guarda hash do request e resposta para replay idempotente |
| `prompt_version` | sim | UK `(promptId, version)`; hash do template de prompt (ver `08-llm-spec.md`) |
| `llm_call_log` | sim | IDX `(proposalId, createdAt)`; tokens/custo/modelo/promptVersion; payloads com retenção e mascaramento |

### 3.1 Snapshot canônico (`proposal_version.snapshot`)
Conteúdo (JSON com chaves ordenadas, sem campos voláteis):

```json
{
  "proposal": { "number": "...", "title": "...", "description": "...", "scope": "...",
    "currency": "BRL", "subtotalMicros": 0, "discountMicros": 0, "totalMicros": 0,
    "validUntil": "2026-09-30", "deliveryTime": "...", "paymentTerms": "...",
    "recipientPhone": "+55...", "companyRef": "uuid", "contactRef": "uuid" },
  "items": [ { "order": 1, "catalogCode": "SRV-001", "description": "...",
    "quantity": 10, "unit": "hora", "unitPriceMicros": 0, "discountPercent": 0,
    "totalMicros": 0, "isOptional": false, "notes": "" } ],
  "commercialTerms": { "...": "..." },
  "template": { "id": "uuid", "version": 3 }
}
```

`snapshotHash = sha256(canonicalJson)`. A lista de campos do snapshot define exatamente **o que invalida aprovação** quando alterado (`07-state-machine.md` §5, `09-approval-and-security.md` §1.1-7).

## 4. Fonte da verdade por informação (normativo)

| Informação | Fonte | Justificativa |
|---|---|---|
| Cliente/contato/oportunidade | Twenty | CRM é dono do relacionamento |
| Dados comerciais correntes da proposta | Twenty | edição sob RBAC, views, kanban |
| Catálogo e templates (cadastro) | Twenty | administração pelo negócio |
| Versões + snapshots + hashes | Serviço | imutabilidade e integridade criptográfica |
| Aprovações (decisão/IP/contexto) | Serviço | trilha legal append-only |
| Mensagens WhatsApp/sessões | Serviço | dados operacionais e LGPD (retenção própria) |
| Eventos técnicos | Serviço | correlationId/causationId, particionamento |
| Artefatos PDF | Storage do serviço | write-once; Twenty só exibe URL assinada |
| Status | Serviço (máquina de estados) | espelhado no campo `status` do Twenty (read-only) |

Reconciliação: job periódico compara espelhos no Twenty com a fonte e corrige divergências (sempre da fonte para o espelho), registrando `proposal_event` `type=MIRROR_RECONCILED` quando houver correção.

## 5. Migrações

- **Twenty**: nenhuma migration manual — a instalação/atualização do App óDois gera as migrações de workspace pelo mecanismo nativo (`engine/workspace-manager/workspace-migration/`). Nenhum instance command do repositório é criado ou alterado.
- **Serviço**: migrations versionadas no repo `odois-proposal-service/` (TypeORM), com `up`/`down`, aplicadas no deploy do serviço — independentes do ciclo de upgrade do Twenty.
