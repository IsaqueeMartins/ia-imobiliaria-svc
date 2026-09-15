# AGENT.md

## 1. Objetivo do Projeto

Este projeto faz parte de uma plataforma de tecnologia voltada para o mercado imobiliário.

O objetivo é fornecer infraestrutura e software para imobiliárias, permitindo que cada cliente tenha sua própria experiência digital, com identidade, domínio, dados e operação independentes.

O sistema deve ser projetado desde o início considerando:

- múltiplos clientes;
- isolamento completo de dados entre clientes;
- sites imobiliários independentes;
- painel administrativo;
- cadastro e gerenciamento de imóveis;
- gerenciamento de corretores;
- gerenciamento de leads;
- autenticação e autorização;
- armazenamento de imagens e arquivos;
- integração com portais imobiliários;
- geração e processamento de conteúdo com IA;
- APIs externas;
- tarefas assíncronas;
- webhooks;
- escalabilidade;
- observabilidade;
- segurança;
- manutenção de longo prazo.

O projeto **não deve ser tratado como um simples template de site imobiliário**.

Cada cliente deve possuir uma aplicação/experiência própria, mesmo que compartilhe infraestrutura e componentes internos.

---

# 2. Princípios Arquiteturais

## 2.1 Separação de responsabilidades

A arquitetura deve separar claramente:

- frontend;
- backend;
- banco de dados;
- armazenamento de arquivos;
- autenticação;
- regras de negócio;
- integrações externas;
- processamento assíncrono;
- infraestrutura.

Não colocar regras complexas de negócio diretamente nos componentes visuais.

Não utilizar o frontend como substituto do backend principal.

---

## 2.2 Backend

O backend principal deve utilizar:

- NestJS;
- TypeScript;
- API REST quando apropriado;
- arquitetura modular;
- validação de entrada;
- autenticação;
- autorização;
- tratamento centralizado de erros;
- logs;
- testes automatizados.

O NestJS deve concentrar as regras de negócio compartilhadas pela plataforma.

Next.js pode possuir funcionalidades server-side quando fizer sentido para determinado site, mas isso não deve substituir automaticamente o backend central.

### Regra

Antes de implementar uma funcionalidade, determinar se ela pertence a:

1. apresentação;
2. frontend;
3. BFF;
4. backend;
5. infraestrutura;
6. processamento assíncrono.

Não misturar essas responsabilidades sem motivo arquitetural.

---

# 3. Frontend

O frontend deve utilizar TypeScript.

A arquitetura deve priorizar:

- componentes reutilizáveis;
- separação entre lógica e apresentação;
- composição;
- baixo acoplamento;
- tipagem forte;
- acessibilidade;
- responsividade;
- performance.

## 3.1 Separação entre lógica e visual

Componentes não devem concentrar lógica complexa e apresentação no mesmo arquivo.

Sempre que houver complexidade suficiente para justificar separação, utilizar estrutura semelhante a:

```text
card/
├── component/
│   ├── component.tsx
│   └── component-view.tsx
```

Onde:

- `component.tsx` contém lógica, estado, hooks e preparação dos dados;
- `component-view.tsx` contém principalmente apresentação.

A nomenclatura pode ser adaptada ao domínio do componente, mas o princípio deve ser preservado.

### Não fazer

```text
Component.tsx
```

contendo centenas de linhas com:

- chamadas HTTP;
- regras de negócio;
- estados complexos;
- transformação de dados;
- lógica de apresentação;
- markup.

### Fazer

Separar responsabilidades e manter cada arquivo pequeno e previsível.

---

# 4. Multi-Tenancy

Multi-tenancy é uma preocupação central da plataforma.

Cada imobiliária deve ser considerada um tenant independente.

Um tenant deve possuir seus próprios:

- imóveis;
- usuários;
- corretores;
- leads;
- arquivos;
- configurações;
- domínio;
- identidade visual;
- integrações;
- informações comerciais;
- dados operacionais.

## 4.1 Isolamento

Um tenant nunca pode acessar dados pertencentes a outro tenant.

Toda entidade que pertença a um tenant deve possuir uma relação explícita com ele quando necessário.

Exemplo conceitual:

```text
Tenant
 ├── Users
 ├── Properties
 ├── Brokers
 ├── Leads
 ├── Files
 ├── Integrations
 └── Settings
```

O isolamento deve ser aplicado no backend.

Nunca confiar exclusivamente no frontend para impedir acesso entre tenants.

---

# 5. Sites dos Clientes

Os sites dos clientes não devem ser tratados simplesmente como "templates".

O modelo de negócio exige sites próprios para cada cliente.

Portanto:

- não criar um repositório por cliente sem necessidade;
- não duplicar código sem justificativa;
- não assumir que todos os clientes terão exatamente a mesma interface;
- não transformar a plataforma em um sistema de templates genéricos.

A arquitetura deve permitir compartilhar infraestrutura e código interno sem obrigar todos os clientes a possuírem a mesma experiência visual.

## 5.1 Separação conceitual

Existem dois produtos diferentes:

### Plataforma

Responsável por:

- administração;
- imóveis;
- usuários;
- corretores;
- leads;
- integrações;
- autenticação;
- APIs;
- arquivos;
- regras de negócio.

### Site do cliente

Responsável por:

- experiência pública;
- identidade visual;
- apresentação dos imóveis;
- busca;
- SEO;
- páginas;
- contato;
- conversão de leads.

Essas responsabilidades não devem ser misturadas indiscriminadamente.

---

# 6. Banco de Dados

O banco deve ser projetado considerando isolamento e escalabilidade.

A estratégia de banco deve evitar:

- duplicação desnecessária de infraestrutura;
- schemas criados manualmente para cada cliente sem necessidade;
- consultas sem tenant scope;
- relações que permitam vazamento de dados.

A estratégia adotada deve permitir que a aplicação identifique claramente o tenant atual e aplique esse contexto às operações.

## 6.1 Regra fundamental

Nenhuma consulta que opere sobre dados de tenant deve ignorar o contexto do tenant.

Evitar:

```ts
propertyRepository.find({
  where: {
    id,
  },
});
```

quando a operação deveria estar limitada ao tenant.

Preferir conceitualmente:

```ts
propertyRepository.find({
  where: {
    id,
    tenantId,
  },
});
```

O padrão exato depende da ORM utilizada.

---

# 7. Armazenamento de Arquivos

O armazenamento de arquivos deve utilizar **Cloudflare R2**.

O R2 deve ser tratado como storage de objetos e não como banco de dados.

Arquivos devem possuir organização lógica por tenant.

Estrutura conceitual:

```text
imob-{tenant}/
├── properties/
│   ├── {property-id}/
│   │   ├── images/
│   │   └── documents/
│
├── users/
│
├── brokers/
│
└── other/
```

A estrutura definitiva deve ser definida de maneira consistente e não alterada arbitrariamente por cada feature.

## 7.1 Regras

Nunca salvar arquivos diretamente no banco de dados quando um object storage for apropriado.

O banco deve armazenar metadados como:

- key;
- bucket;
- URL ou referência;
- MIME type;
- tamanho;
- entidade relacionada;
- tenant;
- timestamps.

Nunca confiar em uma URL enviada pelo frontend como prova de autorização.

A autorização deve acontecer no backend.

---

# 8. Uploads

O fluxo de upload deve ser projetado para permitir escalabilidade.

Quando possível:

```text
Frontend
   ↓
Backend solicita upload
   ↓
R2 / Presigned URL
   ↓
Frontend envia arquivo
   ↓
Backend registra metadados
```

Evitar fazer o backend receber e retransmitir arquivos grandes sem necessidade.

Arquivos devem possuir nomes/chaves previsíveis e seguros.

Nunca utilizar diretamente nomes fornecidos pelo usuário como chave de storage sem sanitização e estratégia própria.

---

# 9. Imóveis

O domínio de imóveis deve suportar, no mínimo:

- apartamento;
- casa;
- terreno;
- venda;
- aluguel;
- valor;
- localização;
- quartos;
- banheiros;
- vagas;
- área;
- descrição;
- título;
- características;
- imagens;
- informações do proprietário;
- informações do corretor;
- status;
- código do imóvel;
- timestamps.

A modelagem deve ser extensível.

Não criar campos específicos de um único cliente diretamente no core sem avaliar se devem ser configuráveis ou generalizados.

---

# 10. Corretores e Usuários

Usuários e corretores devem possuir responsabilidades diferentes quando o domínio exigir.

O sistema deve implementar:

- autenticação;
- autorização;
- roles;
- permissões;
- tenant scope.

Exemplos conceituais:

```text
SUPER_ADMIN
TENANT_ADMIN
BROKER
USER
```

Não assumir que autenticação significa autorização.

Estar autenticado não significa possuir permissão para realizar determinada operação.

---

# 11. Leads

Leads devem possuir estrutura própria.

O sistema deve permitir futuramente:

- origem;
- imóvel relacionado;
- tenant;
- corretor responsável;
- nome;
- telefone;
- email;
- mensagem;
- status;
- histórico;
- timestamps.

O modelo deve permitir integração futura com:

- WhatsApp;
- CRM;
- email;
- portais;
- automações.

---

# 12. Integrações com Portais

A plataforma deverá permitir integração com portais imobiliários, incluindo, quando disponível:

- OLX;
- Chaves na Mão;
- outros portais relevantes.

Não implementar cada integração diretamente dentro do módulo de imóveis.

Criar uma camada de integração.

Conceitualmente:

```text
Property
   ↓
Integration Service
   ├── OLX
   ├── Chaves na Mão
   ├── Portal X
   └── Portal Y
```

Cada integração deve possuir sua própria implementação.

O domínio interno da plataforma não deve depender diretamente do formato de uma API externa.

Utilizar adapters/mappers quando necessário.

---

# 13. IA

A plataforma poderá utilizar IA para funcionalidades como:

### Geração de descrição

Entrada:

```text
características do imóvel
```

Saída:

```text
título
descrição
destaques
```

### Cadastro automático

Possíveis entradas:

- texto;
- PDF;
- planilha;
- descrição;
- documentos estruturados.

A IA deve ser considerada uma camada de processamento.

Não colocar chamadas diretas a modelos de IA espalhadas pelos componentes frontend.

Preferir:

```text
Frontend
   ↓
Backend
   ↓
AI Service
   ↓
Provider
```

O provider deve ser abstraído quando houver benefício real.

---

# 14. API

A API deve possuir:

- versionamento quando necessário;
- DTOs;
- validação;
- documentação;
- tratamento consistente de erros;
- autenticação;
- autorização;
- paginação;
- filtros;
- ordenação;
- limites de requisição quando necessário.

Endpoints devem seguir convenções consistentes.

Exemplo:

```text
GET    /properties
GET    /properties/:id
POST   /properties
PATCH  /properties/:id
DELETE /properties/:id
```

Evitar endpoints semanticamente inconsistentes.

---

# 15. Validação

Toda entrada externa deve ser considerada não confiável.

Validar:

- body;
- params;
- query;
- headers relevantes;
- uploads;
- webhooks;
- payloads de integrações.

Nunca confiar em dados enviados pelo frontend.

---

# 16. Segurança

Segurança é responsabilidade do backend e da infraestrutura.

Nunca:

- expor secrets;
- colocar credenciais no frontend;
- commitar `.env`;
- confiar em `tenantId` fornecido pelo cliente sem validar contexto;
- confiar em permissões enviadas pelo frontend;
- permitir acesso direto a arquivos privados sem autorização;
- logar tokens;
- logar senhas;
- logar dados sensíveis desnecessariamente.

Variáveis sensíveis devem utilizar environment variables ou secret managers apropriados.

---

# 17. Variáveis de Ambiente

Nunca colocar secrets diretamente no código.

Utilizar:

```text
.env
.env.local
```

ou mecanismo equivalente.

Arquivos com secrets não devem ser commitados.

Manter um:

```text
.env.example
```

com os nomes das variáveis necessárias, mas sem valores secretos.

---

# 18. Deploy e Infraestrutura

A infraestrutura deve suportar múltiplos clientes sem exigir duplicação completa de toda a infraestrutura.

A arquitetura deve buscar:

- deploy automatizado;
- CI/CD;
- ambientes separados;
- observabilidade;
- rollback;
- configuração por ambiente;
- escalabilidade.

A infraestrutura deve ser pensada como produto multi-cliente.

---

# 19. Vercel

Quando o backend for hospedado na Vercel, considerar as características do ambiente serverless.

Não assumir comportamento de servidor tradicional.

Verificar sempre:

- entrypoint;
- routing;
- build;
- variáveis de ambiente;
- runtime;
- paths;
- CORS;
- prefixos `/api`;
- comportamento das funções.

Um endpoint que funciona localmente não deve ser considerado funcional em produção sem testar o endpoint real.

---

# 20. CORS

CORS deve ser configurado explicitamente.

Não utilizar:

```text
*
```

em produção quando houver autenticação baseada em cookies/credentials.

Os domínios permitidos devem ser controlados por configuração.

Como existem sites independentes por cliente, a estratégia de CORS deve considerar os domínios autorizados de cada tenant.

---

# 21. Cookies e Autenticação

Quando `credentials` forem utilizados:

- configurar CORS corretamente;
- configurar cookies corretamente;
- considerar `SameSite`;
- considerar `Secure`;
- considerar domínio;
- considerar HTTPS.

Não resolver problemas de autenticação simplesmente desabilitando segurança.

---

# 22. Arquitetura de Código

Preferir módulos orientados ao domínio.

Exemplo:

```text
src/
├── auth/
├── tenants/
├── users/
├── brokers/
├── properties/
├── leads/
├── files/
├── integrations/
├── ai/
└── common/
```

Cada módulo deve possuir responsabilidade clara.

Evitar criar uma pasta gigantesca como:

```text
utils/
```

para colocar qualquer código que não tenha lugar definido.

---

# 23. Services

Services devem conter regras de negócio.

Controllers devem ser finos.

Controller:

```text
receber request
→ validar
→ chamar service
→ retornar response
```

Não colocar regras complexas dentro de controllers.

---

# 24. Repository / Database Access

O acesso ao banco deve ficar isolado da camada de apresentação.

Não acessar banco diretamente dentro de controllers.

Não acessar banco diretamente dentro de componentes React.

---

# 25. Frontend HTTP

O frontend deve possuir uma camada centralizada para comunicação com API.

Evitar espalhar:

```ts
axios.get(...)
fetch(...)
```

por dezenas de componentes.

Utilizar serviços/hooks apropriados.

Exemplo conceitual:

```text
services/
├── auth.service.ts
├── properties.service.ts
├── leads.service.ts
└── users.service.ts
```

---

# 26. Tipagem

TypeScript deve ser utilizado de maneira realmente tipada.

Evitar:

```ts
any;
```

sem justificativa.

Não utilizar `as` indiscriminadamente para silenciar o compilador.

Quando o TypeScript apresentar um erro, corrigir a causa em vez de simplesmente contornar a tipagem.

---

# 27. Comentários no Código

## REGRA OBRIGATÓRIA

**Não adicionar comentários ao código.**

O código deve ser autoexplicativo.

Não adicionar comentários como:

```ts
// Get property
// Check if user exists
// This function handles...
```

Não adicionar comentários para explicar código óbvio.

Também não adicionar comentários apenas para descrever o que uma linha faz.

Se o código precisa de muitos comentários para ser compreendido, provavelmente precisa ser refatorado.

### Proibição absoluta

**Não existe nenhum caso em que um comentário possa ser adicionado, em nenhuma linguagem e em nenhum arquivo de código.**

Isso inclui comentários de documentação (JSDoc), cabeçalhos de arquivo, blocos vazios, trechos de código comentado e marcadores de lint ou de compilador. Quando qualquer um deles parecer necessário, a solução deve vir da configuração do projeto, nunca de um comentário.

Quando um comentário parecer necessário, a alternativa é:

- renomear variáveis, funções e tipos para explicitar a intenção;
- extrair funções pequenas e nomeadas;
- escrever a regra em código, em validação ou em teste;
- mover a configuração para o arquivo de configuração correspondente.

Código comentado também é proibido: o trecho morto deve ser removido e recuperado pelo histórico do git quando necessário.

---

# 28. Nomenclatura

Utilizar nomes descritivos.

Evitar:

```text
data
item
obj
thing
temp
foo
bar
```

quando houver uma definição melhor.

Preferir:

```text
property
tenant
broker
lead
propertyImages
tenantId
```

Funções devem representar claramente sua ação.

Exemplo:

```text
createProperty
updateProperty
deleteProperty
findPropertyById
generatePropertyDescription
```

---

# 29. Código Morto

Não manter:

- imports não utilizados;
- funções não utilizadas;
- componentes abandonados;
- variáveis mortas;
- arquivos antigos;
- código comentado;
- implementações duplicadas.

Se algo não é utilizado e não possui propósito arquitetural, remover.

---

# 30. Não Duplicar Código

Antes de criar uma nova implementação:

1. procurar se já existe;
2. entender como ela funciona;
3. avaliar reutilização;
4. só então criar algo novo.

Não copiar e colar lógica para resolver rapidamente uma feature.

Duplicação aumenta o custo de manutenção e gera divergência entre implementações.

---

# 31. Dependências

Não instalar uma biblioteca para resolver um problema trivial.

Antes de adicionar uma dependência:

1. verificar se o projeto já possui solução;
2. verificar se a funcionalidade pode ser implementada nativamente;
3. avaliar manutenção da biblioteca;
4. avaliar tamanho;
5. avaliar segurança;
6. avaliar compatibilidade com o stack.

Não adicionar dependências sem necessidade.

---

# 32. Alterações Arquiteturais

Não modificar arquitetura estrutural sem necessidade.

Antes de:

- trocar ORM;
- trocar framework;
- alterar autenticação;
- alterar estratégia de tenant;
- alterar storage;
- alterar banco;
- alterar infraestrutura;

avaliar impacto nas demais partes do sistema.

Mudanças grandes devem ser feitas conscientemente e em etapas.

---

# 33. Regras para Agentes de IA

O agente deve trabalhar seguindo este ciclo:

```text
ANALYZE
↓
PLAN
↓
IMPLEMENT
↓
EXECUTE
↓
TEST
↓
FIX
↓
CONTINUE
```

Nunca começar alterando arquivos sem antes entender a estrutura existente.

---

# 34. Antes de Codificar

Sempre:

1. inspecionar estrutura do projeto;
2. verificar package manager;
3. verificar scripts existentes;
4. verificar dependências;
5. verificar configurações;
6. identificar padrões já utilizados;
7. localizar código relacionado à tarefa;
8. entender contratos existentes;
9. verificar testes existentes.

Não assumir que uma estrutura deve existir apenas porque é comum em outros projetos.

---

# 35. Preservação do Código Existente

Não reescrever arquivos inteiros quando uma alteração pequena resolve o problema.

Preservar:

- comportamento existente;
- APIs;
- contratos;
- nomenclaturas;
- arquitetura;
- compatibilidade.

Modificar apenas o necessário.

Quando uma alteração exigir quebra de contrato, identificar explicitamente todos os pontos afetados antes de executá-la.

---

# 36. Não Criar Soluções Fictícias

Nunca implementar uma feature fingindo que uma integração funciona.

Não utilizar:

```text
mock
fake response
placeholder
hardcoded data
```

como implementação definitiva.

Mocks podem existir exclusivamente em testes.

Se uma API externa ainda não estiver disponível, criar uma abstração clara e deixar a integração explicitamente incompleta, em vez de fingir que está funcionando.

---

# 37. APIs Externas

Ao integrar uma API externa:

1. entender o contrato;
2. validar autenticação;
3. validar payload;
4. validar resposta;
5. tratar erros;
6. tratar timeout;
7. tratar rate limits;
8. registrar falhas de forma adequada;
9. não expor credenciais;
10. criar testes.

Nunca assumir que uma API externa sempre responde corretamente.

---

# 38. Tratamento de Erros

Erros devem ser tratados explicitamente.

Não utilizar:

```ts
catch {
}
```

sem motivo.

Não esconder erros.

Não retornar HTTP 200 para operações que falharam apenas para facilitar o frontend.

Utilizar códigos HTTP semanticamente adequados.

---

# 39. Logs

Logs devem ajudar a diagnosticar problemas.

Devem permitir entender:

- qual operação ocorreu;
- quando ocorreu;
- contexto relevante;
- resultado;
- erro.

Nunca registrar:

- senha;
- token;
- secret;
- credenciais;
- informações sensíveis desnecessárias.

---

# 40. Testes

Toda funcionalidade relevante deve possuir testes apropriados.

Prioridade:

1. regras de negócio;
2. autenticação;
3. autorização;
4. isolamento de tenant;
5. integrações;
6. transformação de dados;
7. endpoints críticos.

Testes não devem apenas verificar o caminho feliz.

Devem considerar:

- dados inválidos;
- ausência de dados;
- permissões insuficientes;
- tenant incorreto;
- recurso inexistente;
- falhas externas.

---

# 41. Isolamento de Tenant nos Testes

Sempre que possível, testar explicitamente:

```text
Tenant A não consegue acessar Tenant B
```

Este é um requisito crítico da plataforma.

Exemplo conceitual:

```text
property belongs to tenant A

request authenticated as tenant B

→ 404/403
```

A aplicação nunca deve retornar dados de A.

---

# 42. Banco e Migrations

Alterações estruturais no banco devem utilizar migrations.

Não modificar banco de produção manualmente como prática normal.

Toda migration deve ser:

- reproduzível;
- versionada;
- revisada;
- compatível com o estado esperado da aplicação.

Antes de alterar uma tabela existente, verificar impacto em:

- queries;
- services;
- DTOs;
- frontend;
- integrações;
- migrations;
- dados existentes.

---

# 43. Performance

Não otimizar prematuramente.

Primeiro produzir código correto.

Depois medir.

Problemas de performance devem ser tratados com base em evidência.

Atenção especial para:

- N+1 queries;
- consultas sem índices;
- uploads;
- imagens;
- paginação;
- chamadas externas;
- processamento de IA;
- jobs assíncronos.

---

# 44. Imagens de Imóveis

Imagens são parte importante do produto.

A arquitetura deve considerar:

- múltiplas imagens por imóvel;
- ordenação;
- imagem principal;
- thumbnails;
- compressão;
- formatos modernos;
- cache;
- CDN;
- exclusão;
- substituição;
- associação ao tenant.

O frontend não deve carregar imagens originais gigantes quando uma versão otimizada for suficiente.

---

# 45. SEO

Os sites públicos dos clientes devem ser preparados para SEO.

Considerar:

- SSR/SSG/ISR quando apropriado;
- metadata;
- URLs amigáveis;
- sitemap;
- robots.txt;
- Open Graph;
- dados estruturados;
- performance;
- páginas indexáveis.

Imóveis devem possuir URLs estáveis e semanticamente úteis.

---

# 46. Domínios

Cada cliente pode possuir domínio próprio.

A arquitetura deve permitir:

```text
cliente.com.br
```

apontando para a aplicação correspondente.

O tenant deve ser identificado de forma segura através do domínio/contexto da requisição.

Não confiar em um `tenantId` enviado arbitrariamente pelo frontend para determinar o cliente.

---

# 47. Configuração por Tenant

Configurações específicas do cliente devem ficar associadas ao tenant.

Exemplos:

- nome;
- logo;
- favicon;
- cores;
- domínio;
- telefone;
- email;
- redes sociais;
- configurações de SEO;
- integrações;
- informações comerciais.

Não colocar informações específicas de um cliente diretamente no código compartilhado.

---

# 48. Design e UI

Não assumir que todos os clientes devem possuir exatamente a mesma identidade visual.

Componentes compartilhados devem ser suficientemente desacoplados para permitir personalização.

A arquitetura deve favorecer:

```text
Core
+
Design System
+
Experiência específica do cliente
```

em vez de:

```text
Template rígido
```

---

# 49. Responsividade

Toda interface pública deve funcionar adequadamente em:

- desktop;
- tablet;
- mobile.

Não considerar desktop como prioridade absoluta.

Testar breakpoints relevantes.

---

# 50. Acessibilidade

Interfaces devem considerar:

- HTML semântico;
- navegação por teclado;
- labels;
- contraste;
- estados de foco;
- atributos ARIA quando realmente necessários.

Não utilizar ARIA para compensar HTML semanticamente incorreto.

---

# 51. Git

Commits devem ser pequenos e semanticamente claros.

Evitar commits como:

```text
update
fix
changes
stuff
```

Preferir:

```text
feat: add property image upload
fix: isolate property queries by tenant
refactor: separate property card logic
```

Não incluir arquivos gerados ou secrets no commit.

---

# 52. Pull Requests

Antes de considerar uma tarefa concluída:

- verificar diff;
- remover alterações acidentais;
- verificar imports;
- verificar arquivos novos;
- verificar secrets;
- executar testes;
- executar lint;
- executar typecheck;
- executar build.

---

# 53. Definition of Done

Uma tarefa somente deve ser considerada concluída quando:

- implementação está funcionando;
- arquitetura está coerente;
- não existe duplicação desnecessária;
- não existe nenhum comentário no código;
- não existem secrets expostos;
- tenant isolation foi preservado;
- testes relevantes foram executados;
- lint foi executado;
- typecheck foi executado;
- build foi executado;
- migrations foram verificadas quando aplicável;
- comportamento existente não foi quebrado.

---

# 54. Validação Obrigatória

Sempre que os scripts existirem, executar:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Se o projeto utilizar scripts diferentes, descobrir os scripts existentes antes de executar comandos.

Não afirmar que uma implementação foi validada sem realmente executar as validações disponíveis.

---

# 55. Docker

Quando Docker fizer parte do projeto, validar:

```text
docker build
docker compose
environment variables
networking
ports
health checks
```

Não assumir que funcionar localmente fora do Docker significa que funcionará dentro do ambiente containerizado.

---

# 56. Infraestrutura como Código

Quando a infraestrutura crescer, preferir infraestrutura declarativa e versionada.

Não depender de configurações manuais impossíveis de reproduzir.

Toda configuração crítica deve possuir documentação ou código que permita reconstrução do ambiente.

---

# 57. Desenvolvimento Local

O ambiente local deve ser reproduzível.

Documentar:

- instalação;
- dependências;
- variáveis de ambiente;
- banco;
- migrations;
- seed;
- execução frontend;
- execução backend;
- Docker quando aplicável.

Um novo desenvolvedor deve conseguir executar o projeto sem depender de conhecimento informal.

---

# 58. Não Perguntar Desnecessariamente

O agente não deve interromper a implementação para perguntar algo que possa ser determinado através:

- código existente;
- configuração;
- documentação;
- padrões já utilizados;
- contexto do projeto.

Se houver uma decisão pequena e reversível, escolher a alternativa mais consistente com a arquitetura existente.

Perguntar apenas quando a decisão puder causar impacto arquitetural, perda de dados, alteração de contrato ou comportamento irreversível.

---

# 59. Não Fazer Overengineering

Não implementar infraestrutura futura antes de existir necessidade real.

Evitar adicionar:

- microservices;
- filas;
- abstrações;
- providers;
- camadas;
- bibliotecas;

apenas porque "pode ser útil no futuro".

A arquitetura deve ser preparada para crescer, mas não deve ser artificialmente complexa.

---

# 60. Regra de Ouro

Antes de qualquer alteração, o agente deve responder internamente:

```text
O que já existe?
Por que existe?
Qual responsabilidade estou alterando?
Quem depende disso?
Qual o impacto?
Como vou validar?
```

Depois:

```text
Implementar
→ testar
→ corrigir
→ validar novamente
```

O objetivo não é apenas fazer o código funcionar.

O objetivo é manter uma plataforma imobiliária:

- segura;
- multi-tenant;
- escalável;
- modular;
- testável;
- sustentável;
- fácil de evoluir.

---

# 61. Prioridade das Decisões

Quando houver conflito entre requisitos, utilizar esta ordem:

1. segurança;
2. isolamento de tenant;
3. integridade dos dados;
4. regras de negócio;
5. arquitetura;
6. manutenção;
7. performance;
8. experiência do usuário;
9. conveniência de implementação.

Nunca sacrificar isolamento, segurança ou integridade para tornar uma implementação mais rápida.

---

# 62. Regra Final para Agentes

O agente deve assumir que está trabalhando em um sistema de produção.

Não deve:

- improvisar;
- mascarar erros;
- criar mocks como solução definitiva;
- duplicar código sem necessidade;
- quebrar contratos silenciosamente;
- adicionar comentários desnecessários;
- ignorar testes;
- ignorar erros de build;
- ignorar problemas de typecheck;
- ignorar isolamento de tenant;
- modificar arquitetura sem necessidade.

# 63. Faça commit das alterações

Faça commit das alterações utilizando commits atomicos, ou seja, sempre que uma funcionalidade estiver completa faça um commit para que não haja necessidade de fazer commits grandes após a conclusão da entrega.
 
Toda implementação deve deixar o projeto **melhor do que estava antes da alteração**.
