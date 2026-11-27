# Netlify: validação isolada, sem ativar emissão fiscal

A configuração desta branch prepara build Next.js e quatro agendamentos. O projeto publicado deve ser exclusivo de teste até a validação. Não alterar DNS, domínio, OAuth, webhooks, credenciais ou tráfego da loja atual.

1. Importar o repositório e selecionar esta branch para uma prévia. Usar banco Neon isolado e credenciais de sandbox. Não copiar A1 de produção para a prévia. Não usar tokens de marketplace nem Resend de produção.
2. Configurar o ambiente de runtime pelo painel, nunca em arquivos versionados. Deixar NFE_REAL_HABILITADA, NFE_EMAIL_AUTOMATICO_ENABLED, MATILHA_NETLIFY_CRONS_ENABLED e PORTAL_NOTIFICATIONS_ENABLED desativadas. O código atual ainda restringe a transmissão real à Vercel; não contornar atribuindo VERCEL_ENV=production.
3. Validar build, login, cookies, Prisma, empacotamento dos XSD/WASM, TLS com A1 de homologação, limites de execução e egress. Validar os quatro jobs contra serviços de teste e medir duração e consumo. Scheduled Functions não rodam automaticamente em previews e têm limite próprio de duração.
4. Para habilitar produção fora da Vercel é necessário adaptar os controles de ambiente e transporte, com testes de segurança para impedir emissão em preview. Migrations devem ser aplicadas explicitamente em janela controlada; não simular VERCEL_ENV.
5. Só habilitar crons após validar a exclusividade do agendador e desligar os crons antigos. Evitar duplicidade. O plano gratuito pode interromper o serviço ao consumir a cota. Monitorar uso e definir contingência antes de migrar.

Não há implantação Netlify verificada neste PR. A emissão real continua bloqueada.
