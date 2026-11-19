# Login Google — Matilha Prado

## Status
Implementação preparada em PR; **não publicar sem os testes de autenticação e aprovação**.

## Configuração (somente variáveis do servidor)
No projeto Vercel petshop (Production):
- GOOGLE_CLIENT_ID: Client ID do Google Cloud
- GOOGLE_CLIENT_SECRET: Client Secret (nunca no navegador, README ou pull request)
- GOOGLE_REDIRECT_URI: https://www.matilhaprado.com.br/api/auth/google/callback
- NEXTAUTH_SECRET: manter o mesmo segredo já utilizado na autenticação Matilha Prado
- DATABASE_URL: PostgreSQL/Neon existente

No Google Cloud > Google Auth Platform > Clients > Web application:
- Authorized JavaScript origin: https://www.matilhaprado.com.br
- Authorized redirect URI: https://www.matilhaprado.com.br/api/auth/google/callback
- Consent Screen/Audience: liberar para usuários externos quando a validação estiver concluída

## Segurança e dados
- Fluxo OpenID Connect Authorization Code + PKCE S256, state e nonce de sessão, HTTPS e verificação criptográfica do ID token no servidor com JWKS Google.
- Só contas CLIENTE; login Google não concede acesso à administração ou ao Kanban.
- Identidade persistida por Google sub único em User.googleSub (migration).
- Conta existente com mesmo e-mail ou CPF/CNPJ **não é vinculada automaticamente**; primeiro é preciso entrar com a senha/convite e escolher "Vincular Google" na área do cliente. O e-mail verificado do Google deve coincidir com o e-mail da conta.
- Clientes novos complementam telefone e CPF/CNPJ; o servidor jamais aceita identidade arbitrária do navegador.
- As sessões permanecem usando o cookie HttpOnly matilha_token e a autenticação anterior.
- Segredos OAuth e tokens do Google não são armazenados em banco nem retornados ao navegador.

## Homologação obrigatória
1. Validar schema Prisma e executar migration em banco de teste.
2. Verificar login Google novo, conclusão do cadastro, CPF/CNPJ, sessão e login seguinte.
3. Verificar cliente preexistente: bloqueio de auto-vínculo, vínculo explícito autenticado e preservação de pets, pedidos e agendamentos.
4. Verificar tentativas de state/nonce inválidos, Google cancelado, replay de callback, usuário administrativo, e conta inativa.
5. Testar no domínio real, em iPhone, Android e computador. A configuração Google está em Production, portanto o preview isolado não possui as credenciais por padrão.
6. Confirmar Google OAuth Audience em produção antes de disponibilizar para clientes.

Atenção: publicar a PR aplicará a migration durante o build da Vercel de produção. Confirmar backup do banco e janela de implantação.
