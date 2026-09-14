# Imobiliária AI Service

Microserviço independente de Inteligência Artificial para plataformas imobiliárias. Expõe uma API REST versionada com duas capacidades:

1. **Extração de imóveis a partir de PDF** — recebe um documento PDF não padronizado (digital, escaneado, com marca d'água, com vários imóveis, com um imóvel distribuído em várias páginas) e devolve imóveis estruturados, com confiança, páginas de origem, avisos e erros.
2. **Geração de descrição de imóvel** — recebe o cadastro estruturado de um imóvel e devolve uma descrição profissional em português do Brasil, sem inventar dados.

O projeto é um repositório próprio, sem dependência de código, banco de dados ou domínio do `imobiliaria-back` / `imobiliaria-front`. Nenhum dado é gravado na plataforma: o serviço apenas extrai e gera texto. A validação de negócio, a confirmação do usuário e a persistência continuam sendo responsabilidade da aplicação consumidora.

```
PDF ─► AI Microservice ─► Structured Result ─► imobiliaria-back ─► validação ─► usuário confirma ─► database
Property JSON ─► AI Microservice ─► descrição profissional ─► imobiliaria-back
```

---

## Índice

- [Visão geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Desenvolvimento](#desenvolvimento)
- [Testes](#testes)
- [Build](#build)
- [Produção](#produção)
- [API](#api)
- [Autenticação](#autenticação)
- [Gemini](#gemini)
- [Cloudflare R2](#cloudflare-r2)
- [Deployment](#deployment)
- [Erros](#erros)
- [Decisões de projeto](#decisões-de-projeto)
- [Limites de responsabilidade](#limites-de-responsabilidade)
- [Estrutura de pastas](#estrutura-de-pastas)

---

## Visão geral

| Recurso | Descrição |
| --- | --- |
| Endpoint de extração | `POST /v1/ai/properties/extract` (multipart `file` **ou** JSON com `objectKey`) |
| Endpoint de descrição | `POST /v1/ai/properties/description` |
| Health checks | `GET /health` (liveness) e `GET /ready` (readiness) |
| Documentação | `GET /docs` (Swagger/OpenAPI, controlado por `SWAGGER_ENABLED`) |
| Provider de IA | Abstraído por `AIProvider`; implementação atual: `GeminiProvider` |
| Modelo | Configurável por `GEMINI_MODEL` (padrão `gemini-3.1-flash-lite`), com fallback opcional |
| Structured output | JSON Schema derivado dos mesmos schemas Zod usados na validação |
| Autenticação | `X-API-Key` (abstraída por `ConsumerAuthenticator`, substituível por OAuth/JWT) |
| Multi-tenant | `X-Tenant-Id` + `X-Request-Id`, com isolamento de idempotência por consumidor |
| Rate limiting | Por API key/consumidor, configurável |
| Idempotência | `Idempotency-Key` em memória (porta pronta para Redis) |
| Observabilidade | Logs JSON estruturados, com custo/tokens por chamada de IA |
| Persistência | Nenhuma por padrão (sem banco de dados) |

---

## Arquitetura

NestJS modular, com separação explícita entre domínio, aplicação, infraestrutura e apresentação. O domínio depende de portas (interfaces); a infraestrutura implementa as portas.

```
src/
├── modules/
│   ├── ai/
│   │   ├── application/        # Retry, fallback, prompts, sanitização de descrição, status
│   │   ├── domain/             # Porta AiProvider, erros, uso de tokens
│   │   ├── infrastructure/     # GeminiProvider, Files API, conversão de schema, usage recorder
│   │   └── ai.module.ts
│   ├── documents/
│   │   ├── application/        # DocumentResolver (arquivo enviado ou referência no R2)
│   │   ├── domain/             # Portas DocumentStorage / PdfInspector, tipos, erros
│   │   └── infrastructure/     # Cloudflare R2 (S3 SDK) e pdf-lib
│   ├── properties/
│   │   ├── application/        # Casos de uso (extração, descrição), normalização
│   │   ├── domain/             # Schema de resposta da API
│   │   └── presentation/       # Controller fino, DTOs Zod, documentação Swagger
│   ├── idempotency/            # IdempotencyService + store em memória (porta substituível)
│   └── health/
└── shared/
    ├── auth/                   # ConsumerAuthenticator, ApiKeyAuthenticator, resolução de tenant
    ├── config/                 # Schema Zod das variáveis de ambiente + AppConfigService
    ├── errors/                 # AppError, códigos, filtro global de exceções
    ├── guards/                 # ApiKeyGuard global
    ├── http/                   # Headers e ids de requisição
    ├── interceptors/           # Contexto de requisição (AsyncLocalStorage) e log de acesso
    ├── logging/                # Logger JSON estruturado + sanitização
    ├── openapi/                # Zod → OpenAPI 3.0 para o Swagger
    ├── pipes/                  # ZodValidationPipe
    ├── resilience/             # RetryPolicy (backoff exponencial com jitter)
    ├── types/                  # Contratos compartilhados (vocabulário e schemas de imóvel)
    └── utils/                  # Texto, números pt-BR, PDF, fingerprint
```

Fluxo de extração:

```
Consumer ─► ApiKeyGuard ─► ThrottlerGuard ─► ZodValidationPipe
        ─► DocumentResolver (upload | R2) ─► IdempotencyService
        ─► AIProvider (Retry + Fallback) ─► GeminiProvider ─► Structured Output
        ─► Zod validation ─► PropertyNormalizer (confidence/warnings/pages) ─► Resposta
```

Fluxo de descrição:

```
Consumer ─► ApiKeyGuard ─► ThrottlerGuard ─► ZodValidationPipe
        ─► normalização do payload ─► IdempotencyService
        ─► AIProvider (Retry + Fallback) ─► GeminiProvider ─► { description }
        ─► sanitização (sem emojis/hashtags/títulos) ─► Resposta
```

---

## Requisitos

- Node.js >= 20 (recomendado 22)
- pnpm >= 11 (`corepack enable`)
- Uma API key do Google Gemini (Google AI Studio)
- Opcional: bucket Cloudflare R2 (para o fluxo de referência de documento)

## Instalação

```bash
pnpm install
cp .env.example .env
# preencha GEMINI_API_KEY e API_KEYS
```

## Configuração

Todas as configurações vêm de variáveis de ambiente, validadas por Zod na inicialização via `@nestjs/config`. A aplicação **falha rapidamente** se uma variável obrigatória estiver ausente ou inválida (por exemplo, R2 parcialmente configurado, CORS com `*` em produção, ausência de API keys de consumidor). Todos os problemas encontrados são reportados de uma só vez:

```
[Nest] ERROR [ExceptionHandler] EnvValidationError: Invalid configuration: the AI service cannot start.

  - GEMINI_API_KEY: GEMINI_API_KEY is required. Create a key at https://aistudio.google.com/apikey and set it in the environment
  - API_KEYS: At least one consumer credential is required: set API_KEYS=consumer-key or API_KEYS=consumer-key:tenant-id

Provide the variables above through the process environment or a .env file (see .env.example) and start the service again.
```

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `NODE_ENV` | não | `development` | `development`, `test` ou `production` |
| `PORT` | não | `3000` | Porta HTTP |
| `TRUST_PROXY` | não | `false` | Confia no proxy reverso (Vercel, load balancer) |
| `LOG_LEVEL` | não | `info` | `debug`, `info`, `warn`, `error` |
| `BODY_LIMIT` | não | `1mb` | Limite do corpo JSON (o PDF vai por multipart) |
| `APP_VERSION` | não | — | Versão informada no log de inicialização |
| `API_KEYS` | **sim** (ou `API_KEY`) | — | Lista `chave` ou `chave:tenantId`, separada por vírgula |
| `API_KEY` | não | — | Credencial única (compatibilidade) |
| `GEMINI_API_KEY` | **sim** | — | Credencial do Google Gemini |
| `GEMINI_MODEL` | não | `gemini-3.1-flash-lite` | Modelo principal |
| `GEMINI_FALLBACK_MODELS` | não | — | Modelos de fallback, em ordem de prioridade |
| `GEMINI_INLINE_MAX_MB` | não | `15` | Até esse tamanho o PDF vai inline; acima usa Files API |
| `GEMINI_INPUT_PRICE_PER_MILLION_USD` | não | — | Estimativa de custo de entrada (observabilidade) |
| `GEMINI_OUTPUT_PRICE_PER_MILLION_USD` | não | — | Estimativa de custo de saída (observabilidade) |
| `AI_TEMPERATURE` | não | `0.2` | Temperatura da geração de descrição (extração usa 0) |
| `AI_REQUEST_TIMEOUT` | não | `60000` | Timeout em ms por chamada ao provider |
| `AI_MAX_RETRIES` | não | `2` | Tentativas extras para erros transitórios |
| `AI_RETRY_BASE_DELAY_MS` | não | `500` | Base do backoff exponencial |
| `AI_RETRY_MAX_DELAY_MS` | não | `8000` | Teto do backoff |
| `AI_FALLBACK_ENABLED` | não | `true` | Habilita a cadeia de fallback de modelos |
| `MAX_DOCUMENT_SIZE_MB` | não | `50` | Limite de tamanho do PDF |
| `MAX_DOCUMENT_PAGES` | não | `1000` | Limite de páginas do PDF |
| `R2_ACCOUNT_ID` | não | — | Cloudflare R2 (as 4 variáveis são obrigatórias em conjunto) |
| `R2_ACCESS_KEY_ID` | não | — | Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | não | — | Cloudflare R2 |
| `R2_BUCKET` | não | — | Cloudflare R2 |
| `R2_ENDPOINT` | não | derivado do account id | Sobrescreve o endpoint S3 |
| `R2_ALLOWED_KEY_PREFIXES` | não | — | Prefixos permitidos para `objectKey` (defesa em profundidade) |
| `R2_READINESS_CHECK` | não | `false` | Habilita `HeadBucket` no `/ready` (com cache de 30s) |
| `CORS_ORIGINS` | não | vazio | Origens permitidas; vazio = CORS desabilitado |
| `SWAGGER_ENABLED` | não | `true` fora de produção | Publica `/docs` |
| `RATE_LIMIT_ENABLED` | não | `true` | Habilita rate limiting |
| `RATE_LIMIT_TTL` | não | `60000` | Janela em ms |
| `RATE_LIMIT_MAX` | não | `30` | Requisições por janela por consumidor |
| `IDEMPOTENCY_ENABLED` | não | `true` | Habilita `Idempotency-Key` |
| `IDEMPOTENCY_TTL_SECONDS` | não | `900` | Tempo de retenção da resposta idempotente |

> Nunca commite o arquivo `.env` (já ignorado pelo `.gitignore`).

## Desenvolvimento

```bash
pnpm start:dev     # watch mode
pnpm lint          # ESLint
pnpm format        # Prettier
pnpm typecheck     # tsc --noEmit
```

## Testes

```bash
pnpm test          # testes unitários (Jest, tests/unit)
pnpm test:watch
pnpm test:cov
pnpm test:e2e      # testes de integração (tests/integration, supertest)
```

- `tests/unit` — serviços, parsers, validators, normalizers, retry, erros, prompts e provider Gemini (client mockado).
- `tests/integration` — controllers, autenticação, validação, rate limiting, fluxo de extração e de descrição.
- `tests/fixtures` — PDFs gerados em tempo de execução (pdf-lib) e payloads artificiais. Nenhum PDF real ou dado sensível é versionado.

Os testes de integração substituem o provider de IA por um mock (`AI_PROVIDER`), portanto **não consomem tokens** e não dependem da API real do Gemini.

## Build

```bash
pnpm build         # nest build → dist/main.js e dist/serverless.js
pnpm start:prod    # node dist/main
```

## Produção

```bash
NODE_ENV=production pnpm start:prod
```

Em produção o serviço:

- valida toda a configuração na inicialização e encerra com exit code 1 se algo estiver inválido;
- não expõe stack traces nas respostas;
- não registra API keys, credenciais, corpos de documento nem dados sensíveis;
- não publica `/docs` por padrão (`SWAGGER_ENABLED` controla);
- exige `CORS_ORIGINS` explícito (o curinga `*` é rejeitado).

---

## API

Todos os endpoints são versionados sob `/v1`. A documentação interativa fica em `/docs` (Swagger/OpenAPI 3.0), com exemplos de request/response, headers e erros.

### `POST /v1/ai/properties/extract`

Transforma um PDF em imóveis estruturados. Aceita duas formas de entrada:

**Opção A — upload direto (multipart/form-data):**

```bash
curl -X POST http://localhost:3000/v1/ai/properties/extract \
  -H "X-API-Key: $API_KEY" \
  -F "file=@catalogo.pdf"
```

**Opção B — referência a um documento no R2 (application/json):**

```bash
curl -X POST http://localhost:3000/v1/ai/properties/extract \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-123",
    "documentId": "document-456",
    "objectKey": "tenants/tenant-123/ai-imports/document-456/original.pdf"
  }'
```

Recomenda-se a opção B para arquivos grandes e fluxos assíncronos. As credenciais do R2 nunca são expostas ao frontend.

Resposta (HTTP 200):

```json
{
  "requestId": "req_123",
  "document": {
    "id": "document-456",
    "pages": 12,
    "sizeBytes": 845312,
    "source": "storage",
    "filename": "original.pdf",
    "tenantId": "tenant-123",
    "documentId": "document-456",
    "objectKey": "tenants/tenant-123/ai-imports/document-456/original.pdf"
  },
  "properties": [
    {
      "title": "Apartamento no Gonzaga",
      "type": "apartment",
      "transaction": "sale",
      "price": 750000,
      "rentalPrice": null,
      "condominiumFee": null,
      "iptu": null,
      "area": 120,
      "privateArea": null,
      "builtArea": null,
      "totalArea": null,
      "bedrooms": 3,
      "suites": null,
      "bathrooms": 2,
      "parkingSpaces": 2,
      "location": {
        "address": null,
        "number": null,
        "complement": null,
        "neighborhood": "Gonzaga",
        "city": "Santos",
        "state": "SP",
        "zipCode": null
      },
      "features": ["varanda", "piscina"],
      "description": null,
      "confidence": { "overall": 0.95, "fields": { "price": 0.95, "area": 0.5 } },
      "source": { "pages": [1, 2] },
      "warnings": [
        {
          "code": "CONFLICTING_AREA",
          "message": "Different area values were found in the document.",
          "field": "area",
          "pages": [2, 5],
          "propertyIndex": 0
        }
      ]
    }
  ],
  "warnings": [],
  "errors": [],
  "usage": {
    "provider": "gemini",
    "model": "gemini-3.1-flash-lite",
    "inputTokens": 8420,
    "outputTokens": 1180,
    "totalTokens": 9600,
    "durationMs": 9123
  }
}
```

Regras do contrato:

- informação ausente é `null` (nunca `"Não informado"`, nunca inventada);
- `properties` pode ser parcial: se um imóvel falhar na normalização, os demais são mantidos e o problema aparece em `errors`;
- `warnings` (documento) e `property.warnings` (imóvel) reportam conflitos, ambiguidades e páginas fora do intervalo;
- `source.pages` permite auditoria e revisão humana no frontend;
- nenhum imóvel identificado → `422 AI_EXTRACTION_FAILED` com os avisos em `details`;
- `Idempotency-Replayed: true` indica que a resposta veio do cache de idempotência.

### `POST /v1/ai/properties/description`

Recebe o cadastro estruturado e devolve **somente** a descrição. Campos aceitos em formato numérico ou texto (`"R$ 750.000,00"`, `"120 m²"`). A localização pode ser enviada de forma plana (`city`, `neighborhood`, ...) ou aninhada (`location`), priorizando os campos planos.

```bash
curl -X POST http://localhost:3000/v1/ai/properties/description \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "style": "professional",
    "property": {
      "type": "apartment",
      "transaction": "sale",
      "price": 750000,
      "area": 120,
      "bedrooms": 3,
      "bathrooms": 2,
      "parkingSpaces": 2,
      "city": "Santos",
      "neighborhood": "Gonzaga",
      "features": ["varanda", "piscina"]
    }
  }'
```

Resposta (HTTP 200):

```json
{
  "description": "Apartamento de três dormitórios no Gonzaga, com varanda e piscina..."
}
```

A IA **não altera** os dados recebidos e **não inventa** nada: se uma informação não estiver no payload, ela simplesmente não é mencionada. Estilos disponíveis: `professional` (padrão), `premium`, `direct`, `commercial`.

### Headers

| Header | Obrigatório | Uso |
| --- | --- | --- |
| `X-API-Key` | sim (exceto `/health`, `/ready`, `/docs`) | Identifica o consumidor |
| `X-Tenant-Id` | não | Contexto de tenant; se a chave estiver vinculada a um tenant, precisa coincidir |
| `X-Request-Id` | não | Correlação; gerado quando ausente e devolvido na resposta |
| `Idempotency-Key` | não | Evita reprocessamento (e custo) em repetições |

### Health checks

- `GET /health` → liveness, sem chamada paga à IA.
- `GET /ready` → readiness: configuração, credencial do provider e disponibilidade do storage (sem consumir créditos de IA). Responde `503` quando o serviço não está pronto.

---

## Autenticação

- O consumidor envia `X-API-Key`. As chaves são configuradas em `API_KEYS` no formato `chave` ou `chave:tenantId`.
- As chaves nunca são armazenadas em texto puro em memória nem nos logs: apenas o SHA-256 (truncado) é usado como identidade (`key_...`) para logs, métricas e idempotência.
- A comparação é feita em tempo constante (`timingSafeEqual`).
- `X-Tenant-Id` **não** é mecanismo de autenticação: identifica o contexto. Se a chave estiver vinculada a um tenant, um header divergente resulta em `403 FORBIDDEN`.
- O tenant identifica o contexto; a autenticação identifica quem pode usar o serviço.
- A autenticação está atrás da porta `ConsumerAuthenticator`. Trocar por OAuth/JWT significa apenas fornecer outra implementação — guards, controllers e casos de uso permanecem inalterados.

---

## Gemini

### Provider abstraído

O domínio depende apenas da porta:

```ts
interface AiProvider {
  readonly name: string;
  readonly model: string;
  extractProperties(input: ExtractPropertiesInput): Promise<ExtractPropertiesResult>;
  generatePropertyDescription(
    input: GeneratePropertyDescriptionInput,
  ): Promise<GeneratePropertyDescriptionResult>;
}
```

A implementação atual é `GeminiProvider` (SDK oficial `@google/genai`). Adicionar `OpenRouterProvider` ou qualquer outro provider significa criar uma classe que implemente a interface — nenhum caso de uso, controller ou schema precisa mudar.

O módulo monta a cadeia `RetryingAiProvider(GeminiProvider)` para cada modelo e envolve tudo em `FallbackAiProvider`. A ordem é sempre do modelo mais barato para o mais poderoso.

### Modelo configurável

```env
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.5-flash
AI_FALLBACK_ENABLED=true
```

O nome do modelo aparece em um único lugar (configuração → factory). Nada é hardcoded.

### Structured output

- A resposta é gerada com `responseMimeType: application/json` e `responseSchema`.
- O JSON Schema enviado ao Gemini é **derivado do mesmo schema Zod** usado para validar a resposta (`z.toJSONSchema` + sanitização para o subconjunto suportado: sem `$schema`, `default`, `additionalProperties`, `minLength`, `propertyNames`; `anyOf` com nulo convertido em `nullable`).
- Depois da resposta: `JSON.parse` → `Zod.parse` (validação estrita) → normalização → resposta da API. Schema inválido gera `AI_INVALID_RESPONSE`, elegível para retry e fallback.

### PDFs

- Até `GEMINI_INLINE_MAX_MB` o PDF é enviado inline em base64.
- Acima disso, o documento é enviado pela **Files API** (`files.upload`), aguardando o estado `ACTIVE`, e **removido** (`files.delete`) ao final da requisição.
- `MAX_DOCUMENT_SIZE_MB` e `MAX_DOCUMENT_PAGES` são aplicados antes de chamar a IA (413 `DOCUMENT_TOO_LARGE`).
- O sistema nunca assume `1 página = 1 imóvel`: o prompt exige consolidação por contexto e o schema pede `sourcePages` de cada imóvel.

### Retry e fallback

- Retry com backoff exponencial + jitter para `429`, `5xx`, timeout e falhas de transporte.
- Sem retry para payload inválido, PDF inválido, autenticação inválida e erros não transitórios.
- Fallback de modelo apenas em situações configuradas: erro transitório após esgotar as tentativas, `AI_INVALID_RESPONSE` e `AI_RATE_LIMIT`.
- A API key do Gemini nunca é aceita via request.

### Controle de uso

Cada tentativa registra um evento estruturado `ai.usage` com provider, modelo, operação, `requestId`, `tenantId`, consumidor, tokens de entrada/saída, duração, status, código de erro e custo estimado (quando os preços por milhão de tokens estiverem configurados). Isso permite responder “tenant A: 100 PDFs, custo X” sem banco de dados.

---

## Cloudflare R2

- A infraestrutura existente usa Cloudflare R2; o serviço é compatível via SDK S3 (`@aws-sdk/client-s3`), sem criar dependência de outro storage.
- O R2 é usado quando o fluxo exige persistência/leitura de documento (opção B). O upload direto continua disponível e não exige storage configurado.
- Nenhuma credencial é enviada ao frontend: o serviço lê o objeto no bucket e envia o conteúdo à IA.
- `objectKey` é validado: sem `..`, sem barra inicial, sem caracteres de controle e, se `R2_ALLOWED_KEY_PREFIXES` estiver definido, restrito aos prefixos permitidos (403 `FORBIDDEN` quando fora).
- O tamanho é conferido por `ContentLength` antes de ler o corpo, evitando baixar objetos gigantes.
- `tenantId`, `documentId` e `objectKey` são usados apenas para rastreabilidade — o serviço não conhece o domínio da plataforma principal.
- `R2_READINESS_CHECK=true` habilita um `HeadBucket` no `/ready` (com cache de 30s). O `/health` nunca chama serviços externos.

---

## Deployment

### Docker

```bash
docker build -t imobiliaria-ai-service .
docker run --env-file .env -p 3000:3000 imobiliaria-ai-service
```

O `Dockerfile` é multi-stage (Node 22 alpine + pnpm), roda como usuário `node`, expõe `3000` e possui `HEALTHCHECK` em `/health`.

### Vercel

O projeto é compatível com Vercel sem limitar a arquitetura a ela:

- `vercel.json` executa `pnpm build` e encaminha todas as rotas para `api/index.js`;
- `api/index.js` reaproveita o handler Express criado por `src/serverless.ts` (instância única, reutilizada entre invocações);
- limitação conhecida: funções serverless da Vercel limitam o corpo da requisição (~4,5 MB). Para PDFs grandes, use a **opção B** (referência `objectKey` no R2), que também é o fluxo recomendado para documentos grandes e processamento assíncrono.

### Qualquer host Node

```bash
pnpm build && NODE_ENV=production pnpm start:prod
```

---

## Erros

Formato padronizado para todas as falhas (sem stack trace em produção):

```json
{
  "statusCode": 422,
  "code": "AI_EXTRACTION_FAILED",
  "message": "Unable to extract properties from document.",
  "requestId": "req_123",
  "details": {}
}
```

| Código | HTTP | Quando ocorre |
| --- | --- | --- |
| `INVALID_REQUEST` | 400 | Payload malformado, ausência de fonte de documento, `objectKey` inválido |
| `VALIDATION_ERROR` | 400 | Falha de validação Zod, com `details.issues` |
| `UNAUTHORIZED` | 401 | `X-API-Key` ausente ou inválido |
| `FORBIDDEN` | 403 | Tenant divergente da chave ou `objectKey` fora dos prefixos |
| `NOT_FOUND` | 404 | Rota inexistente |
| `DOCUMENT_NOT_FOUND` | 404 | Objeto ausente no storage |
| `DOCUMENT_TOO_LARGE` | 413 | Excede `MAX_DOCUMENT_SIZE_MB` ou `MAX_DOCUMENT_PAGES` |
| `UNSUPPORTED_DOCUMENT` | 422 | Arquivo que não é PDF, PDF corrompido ou criptografado |
| `RATE_LIMIT_EXCEEDED` | 429 | Limite de requisições do consumidor |
| `AI_RATE_LIMIT` | 429 | Limite do provider de IA |
| `IDEMPOTENCY_CONFLICT` | 409 | Mesma `Idempotency-Key` com payload diferente |
| `STORAGE_NOT_CONFIGURED` | 503 | Referência de storage usada sem R2 configurado |
| `STORAGE_ERROR` | 502 | Falha ao ler o storage |
| `AI_PROVIDER_ERROR` | 502 | Erro inesperado do provider |
| `AI_INVALID_RESPONSE` | 502 | Resposta fora do schema esperado |
| `AI_TIMEOUT` | 504 | Timeout do provider |
| `AI_EXTRACTION_FAILED` | 422 | Nenhum imóvel identificado no documento |
| `AI_DESCRIPTION_FAILED` | 422 | Descrição vazia/inválida retornada |
| `INTERNAL_ERROR` | 500 | Falha inesperada do serviço |

---

## Decisões de projeto

**Confiança da extração.** Cada imóvel retorna `confidence.overall` (informado pelo modelo, 0–1) e `confidence.fields`, calculado pelo normalizador por campo preenchido:

- valor presente e sem aviso → confiança reportada (ou `0.8` quando o modelo não informa nenhuma, com o aviso `MISSING_FIELD_CONFIDENCE`);
- campo com `CONFLICTING_*`, `AMBIGUOUS_VALUE` ou `INVALID_VALUE` → confiança reduzida para no máximo `0.5`;
- informação ausente → `null` no valor e ausente em `fields`.

Isso distingue claramente: encontrado, ambíguo e ausente — sem inventar dados e sem custo extra de tokens.

**Conflitos.** Quando o documento traz dois valores para o mesmo campo, o modelo é instruído a manter o valor mais explícito, registrar um aviso (`CONFLICTING_AREA`, `CONFLICTING_PRICE`, ...) com o campo e as páginas envolvidas. O conflito nunca é escondido.

**Idempotência.** `Idempotency-Key` é opcional. Quando presente, a chave do store é `escopo:consumidor:chave`, o que isola tenants. Requisições simultâneas com a mesma chave compartilham a mesma promessa (uma única chamada de IA); repetições posteriores recebem a resposta armazenada com `Idempotency-Replayed: true`. Se a operação falhar, o registro é removido para permitir nova tentativa. A porta `IdempotencyStore` permite trocar o store em memória por Redis sem alterar os casos de uso.

**Rate limiting.** Aplicado por consumidor (`key_...`), com fallback para tenant e IP. As rotas de health são isentas. Um consumidor não consegue consumir todo o Free Tier nem gerar custos excessivos.

**Preparado para assíncrono.** O `DocumentResolver` e a porta `AIProvider` isolam o processamento, e o fluxo por `objectKey` já desacopla o upload do processamento. Introduzir `202 Accepted` + `GET /v1/ai/jobs/:id` com BullMQ/Redis exige apenas um novo dispatcher e um store de jobs — sem reescrever controllers, casos de uso ou normalização.

**Sem banco de dados.** A primeira versão não cria PostgreSQL nem tabelas do domínio imobiliário. Persistência só será adicionada quando houver necessidade real (jobs assíncronos, auditoria, idempotência distribuída, métricas de consumo). Hoje, o consumo é observável por logs estruturados.

**Observabilidade.** Todo log é JSON de uma linha, com `requestId`, `tenantId`, `consumerId`, `path` e um `event` previsível (`http.request.completed`, `ai.usage`, `ai.provider.retry`, `ai.provider.fallback`, `idempotency.replayed`, ...). O pipeline `request → document → provider → model → response` é rastreável sem registrar conteúdo sensível: valores binários viram `<binary:N bytes>`, chaves sensíveis viram `[REDACTED]` e strings longas são truncadas.

---

## Limites de responsabilidade

Este microserviço é um serviço de **extração e geração assistida por IA**. Ele **não** garante que os dados extraídos sejam juridicamente verdadeiros.

- Não cadastra imóveis, não conhece regras do `imobiliaria-back` e não acessa o banco da plataforma.
- A aplicação consumidora continua responsável por validação de negócio, confirmação do usuário, persistência e publicação.
- A IA nunca tem autoridade para gravar um imóvel diretamente no banco da plataforma principal.

---

## Estrutura de arquivos relevante

```
├── api/index.js                  # handler serverless (Vercel)
├── src/
│   ├── app.module.ts             # módulos, guards, interceptors e filtro globais
│   ├── app.setup.ts              # helmet, CORS, body limit, Swagger
│   ├── main.ts                   # bootstrap HTTP (falha rápida de configuração)
│   └── serverless.ts             # bootstrap reaproveitado em serverless
├── tests/
│   ├── unit/                     # Jest (services, schemas, normalização, erros)
│   ├── integration/              # supertest (auth, validação, fluxos, rate limit)
│   ├── fixtures/                 # PDFs gerados em runtime e payloads artificiais
│   └── jest-e2e.json
├── Dockerfile / .dockerignore / vercel.json
└── .env.example
```

---

## Licença

MIT.




