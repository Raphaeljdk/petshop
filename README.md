# Matilha Prado

Sistema de gestão de pet shop com painel administrativo, agenda, loja e portal do cliente. Next.js 16, React 19, TypeScript, Tailwind CSS e Prisma.

## Login e cadastro

| Endereço | Uso |
| --- | --- |
| /login | Acesso com e-mail e senha; o papel salvo na conta determina o painel |
| /cadastro | Cadastro público de cliente com nome, telefone e senha |
| /cadastro/administrador | Cadastro de administrador com convite individual |
| Painel → Equipe e convites | Gerar, consultar e revogar convites de administradores |

Os mesmos formulários estão disponíveis nos botões da página inicial. Incluem confirmação e visualização de senha, alerta de Caps Lock, validação junto aos campos, telefone e CEP formatados, endereço opcional, navegação por teclado e movimento reduzido.

O cadastro público não aceita privilégios de administrador. O convite administrativo é ligado a um e-mail, expira em 48 horas e é consumido na mesma transação da criação da conta. Apenas o hash do código fica no banco. Administradores inativos não autorizam novos cadastros.

Clientes já registrados pela loja precisam de atendimento da equipe para comprovar sua identidade e vincular o acesso existente. O cadastro público não assume que conhecer um e-mail autoriza acesso ao histórico de um cliente.

## Executar localmente

Requer Node.js 20.19+ para o script de convite; os comandos de testes usam Bun 1.3.4.

1. Copie .env.example para .env e configure DATABASE_URL com uma URL PostgreSQL.
2. Gere NEXTAUTH_SECRET com pelo menos 32 caracteres aleatórios. Exemplo:

~~~bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
~~~

3. Instale e atualize o banco:

~~~bash
npm install
npx prisma generate
npx prisma db push
npm run dev
~~~

A atualização usa PostgreSQL e adiciona AdminInvitation e AuthAttempt. Em um banco existente, revise as alterações do schema e faça backup antes de aplicá-las. O comando db:push não aceita perda de dados automaticamente.

## Primeiro administrador

Em um ambiente confiável, com o .env conectado ao banco correto:

~~~bash
npm run admin:invite -- --email administrador@exemplo.com
~~~

Abra /cadastro/administrador, preencha o mesmo e-mail, nome, senha, confirmação e o código exibido pelo comando. A conta é criada após validar o convite; não existe senha padrão nem cadastro público sem convite.

Após entrar, use **Equipe e convites** para adicionar outros administradores. Copie o convite enquanto estiver visível e compartilhe em particular com a pessoa autorizada. Não há envio automático de e-mail. Gerar um novo convite para o mesmo endereço revoga os anteriores ainda não usados.

## Sessão e validação

- A senha deve ter pelo menos 10 caracteres, uma letra e um número e no máximo 72 bytes UTF-8. O limite evita truncamento pelo bcrypt.
- Senhas são armazenadas com bcrypt; novas contas usam custo 12.
- Cookies HTTP-only com SameSite=Lax e Secure em produção.
- Sessão de navegador com token válido por até 12 horas. A opção de manter conectado usa validade de sete dias.
- Permissões e estado ativo são conferidos no banco nas requisições autenticadas.
- Tentativas de login e cadastro são limitadas por conta no banco, inclusive entre instâncias.
- JSON inválido, campos inesperados, origens cruzadas e erros de configuração recebem respostas controladas.
- Senhas e códigos não são armazenados no navegador nem retornados nas consultas da equipe.

A ajuda de acesso orienta o contato com a equipe. Recuperação automática por e-mail não faz parte desta alteração.

## Verificação

O workflow **Authentication checks** executa Prisma, ESLint, build, TypeScript, 16 testes de API e verificações de interface em Chromium (320, 390 e 1440 pixels). Usa exclusivamente um banco temporário e contas sintéticas. As prévias são anexadas ao workflow.

Para reproduzir as verificações de API, a partir de um terminal preparado para testes:

~~~bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/matilha_auth_test?schema=public"
export NEXTAUTH_SECRET="chave-exclusiva-para-testes-com-mais-de-32-caracteres"
npx prisma db push
npm run build
bun run test:auth
~~~

O script de interface requer o caminho do módulo Playwright em PLAYWRIGHT_MODULE; veja o workflow para a instalação isolada do navegador.

## Integração Siggma / Zettabrasil

Os dados operacionais do pet shop devem ter o **Siggma como fonte oficial**. O Hub acessa esses dados pelo backend usando a API REST disponibilizada pela Zettabrasil; as credenciais nunca são expostas ao navegador.

Variáveis necessárias:

~~~env
SIGGMA_BASE_URL="https://virtuais.zettabrasil.com.br/siggma-integracoesapis"
SIGGMA_CLIENT_ID=""
SIGGMA_CLIENT_SECRET=""
SIGGMA_EMP=""
~~~

O ambiente de homologação é obrigatório durante a validação. Depois dos testes, altere somente `SIGGMA_BASE_URL` para `https://sistema.zettabrasil.com.br/siggma`.

A autenticação da API usa `POST /v2/oauth` com `grant_type=client_credentials_emp`. O token retornado fica apenas no servidor e é renovado automaticamente.

Rotas internas administrativas já preparadas:

- `GET /api/admin/siggma/status` — verifica configuração e autenticação sem expor credenciais.
- `GET /api/admin/siggma/dados?recurso=clientes`
- `GET /api/admin/siggma/dados?recurso=animais&cliente=<cliCod>`
- `GET /api/admin/siggma/dados?recurso=vacinas&animal=<id>`
- `GET /api/admin/siggma/dados?recurso=atendimentos&cliente=<cliCod>`
- `GET /api/admin/siggma/dados?recurso=produtos`

O PostgreSQL definido em `DATABASE_URL` permanece, por enquanto, somente para dados próprios do Hub que não existem na API do Siggma, como autenticação, convites e configurações internas. Antes de produção, essa conexão deve apontar para uma base/schema dedicado e autorizado pelo cliente. Não conecte o Prisma diretamente ao schema central do ERP.


## Publicação na Vercel

Configure DATABASE_URL para uma base/schema dedicado ao Hub, além de NEXTAUTH_SECRET e das variáveis SIGGMA_*. O banco Neon usado durante desenvolvimento não deve ser tratado como fonte oficial dos dados operacionais. A criação/migração das tabelas do Hub deve ser executada de forma controlada, fora do build da Vercel:

~~~bash
npx prisma db push
~~~

O backend recusa segredo ausente ou curto em produção. Não execute reset nem `prisma db push` automaticamente contra banco de produção.

Nunca publique .env, banco, convites, senhas, contratos ou credenciais no repositório.

## Acesso direto ao banco Siggma

A Zettabrasil confirmou que o banco é PostgreSQL e que o acesso direto será liberado apenas para leitura. Toda criação, alteração ou exclusão deve continuar sendo feita pela API oficial do ERP, para preservar validações e regras de negócio.

Parâmetros já confirmados:

- SGBD: PostgreSQL
- Porta: 5734
- Permissão: somente leitura
- SSL/TLS: obrigatório, com `sslmode=require`
- Origem permitida: servidor Oracle com IP público reservado `146.235.58.230`

As credenciais do banco não devem ser configuradas na Vercel nem commitadas no GitHub. Elas devem ficar somente como secrets/variáveis de ambiente no servidor Oracle responsável pelo acesso direto.

Variáveis previstas no servidor Oracle:

~~~env
SIGGMA_DB_HOST=""
SIGGMA_DB_PORT="5734"
SIGGMA_DB_NAME=""
SIGGMA_DB_USER=""
SIGGMA_DB_PASSWORD=""
SIGGMA_DB_SSLMODE="require"
~~~

Arquitetura:

~~~text
Navegador
   |
   v
Vercel / Matilha Prado
   |-----------------------> API Siggma (leituras/escritas suportadas)
   |
   +---- HTTPS privado ----> Oracle VM (146.235.58.230)
                                |
                                +---- PostgreSQL:5734 + SSL ----> Banco Siggma (somente leitura)
~~~

Não abrir a porta 5734 na Oracle para entrada. A VM apenas inicia uma conexão de saída para o banco da Zettabrasil. A exposição pública do banco permanece controlada pela whitelist da Zettabrasil.

Sem webhooks/callbacks, a sincronização deve usar consultas incrementais da API por `since` e, quando necessário, consultas de leitura no PostgreSQL.
