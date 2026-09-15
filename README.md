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

## Publicação na Vercel

Use Neon Postgres na Vercel e configure as variáveis DATABASE_URL e NEXTAUTH_SECRET no projeto antes do deploy de produção. Depois execute o schema Prisma no banco conectado:

~~~bash
npx prisma db push
~~~

O backend recusa segredo ausente ou curto em produção. Não execute reset do banco de produção.

Nunca publique .env, banco, convites, senhas, contratos ou credenciais no repositório.
