# Portal Matilha Prado: homologacao financeira e notificacoes

Branch: feat/portal-cliente-blog-cuidados-20261116. PR #123 permanece draft, sem deploy na producao.

## Assinaturas e renovacao automatica
- Mercado Pago /preapproval usa status pending, recorrencia mensal e link de checkout HTTPS.
- Necessario MERCADO_PAGO_ACCESS_TOKEN valido, Mercado Pago ativo, APP_URL HTTPS e MERCADO_PAGO_WEBHOOK_SECRET.
- O webhook /api/pagamento/assinaturas/webhook requer assinatura valida e consulta o pagamento pelo servidor em /authorized_payments/{id}. Somente fatura aprovada ativa/renova sessoes.
- Incluir subscription_preapproval, subscription_authorized_payment e payments nos topicos do aplicativo Mercado Pago.
- Por ora, apenas planos de 30 dias de referencia estao elegiveis para cobranca automatica. Mercado Pago agenda por mes de calendario.
- Cancelar encerra cobranças futuras e preserva o periodo ja pago.

## Vale-presente
- A loja valida manualmente pagamento antes de emitir o codigo e carregar o saldo em centavos.
- No carrinho, o cliente informa o codigo para aplicar credito. Credito nao e desconto fiscal.
- Cobre integralmente: compra paga com saldo ja adquirido; credito parcial: valor restante e cobrado por Mercado Pago.
- Pedido pendente cancelado devolve reserva. Pagamento aprovado consome saldo uma unica vez.
- Estornos de vendas concluidas ainda exigem reconciliacao manual.
- Voucher pode ser restrito ao e-mail informado; caso contrario o codigo funciona como titulo ao portador.

## Indicacoes
- Gestor define na aba Relacionamento: ativacao, valor de bonus, compra minima e dias de validade.
- Primeiro pedido efetivamente pago de cliente indicado gera cupom pessoal de desconto ao indicador.
- Uso unico, exclusivo e nao pode ser aplicado em outra conta.
- Nao ha bonus padrao; precisa de aprovacao comercial do cliente.

## Notificacoes
- Ativar PORTAL_NOTIFICATIONS_ENABLED=true e CRON_SECRET.
- Cron /api/cron/portal-notificacoes as 11:00 UTC, diariamente.
- Para e-mail: RESEND_API_KEY, INVITATION_EMAIL_FROM, APP_URL HTTPS e opcional INVITATION_EMAIL_REPLY_TO.
- Para WhatsApp Cloud API: META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID, META_WHATSAPP_GRAPH_VERSION e META_WHATSAPP_TEMPLATE_APPOINTMENT previamente aprovado em pt_BR com um parametro no corpo.
- Preferencias do tutor controlam cada canal de lembretes; ausencia de consentimento impede o envio.
- Oferta por e-mail/WhatsApp nao e disparada automaticamente; demanda campanha explicitamente autorizada e template apropriado.

## PDF privado
- Arquivos ate 1MB e 15 documentos por tutor, guardados em banco privado e baixados somente com sessao do proprietario.
- Download sem cache e como anexo. Nenhum PDF e listado para familiares convidados.
- Para escala futura: migrar a objetos privados, URL assinada temporaria, antivírus e retencao.

## Roteiro de homologacao
1. Aplicar ambas as migrations da PR em branch isolada do Neon, com snapshot.
2. Confirmar CI, TypeScript, Prisma, testes de login de cliente e permissao cruzada.
3. Simular fluxo de assinaturas com credenciais de teste de Mercado Pago; repetir webhooks e testar cancelamento e renovacao.
4. Conferir pagamento de vales parcial/total e saldo devolvido em cancelamento. Validar NF-e e forma de pagamento com contador antes de emissao real.
5. Testar bonus por primeira compra paga, uso unico, isolamento de cliente e expiracao.
6. Testar e-mail com dominio autenticado e WhatsApp somente com template aprovado; confirmar consentimento e indisponibilidade sem credenciais.
7. Testar upload, leitura e exclusao de PDF com duas contas distintas.
8. Revisar visual desktop e celular; somente apos homologacao considerar merge e publicacao.

Ainda nao ha confirmacao de credenciais de pagamento, provedores de envio ou validacao ponta a ponta nesta branch.

## Diagnóstico de ativação em 16/11/2026

- Código e dados do portal ainda estão na PR #123, não na `main`; a produção Vercel não usa a PR.
- O valor do bônus é editável pelo administrador em **Relacionamento > Indique e Ganhe**, com valor em reais, compra mínima, validade, ativar/desativar e botão para salvar.
- O domínio de remetente `matilhaprado.com.br` está com **verificação failed** no Resend. Os registros DKIM e SPF precisam ser corrigidos no DNS externo; Vercel informou nomes de servidores `e.sec.dns.br` e `f.sec.dns.br`. Não ative disparos reais até confirmação `verified` no Resend.
- Credenciais e segredo de webhook do Mercado Pago foram identificados nas variáveis de produção da Vercel, mas isso não equivale à aprovação de teste financeiro real.
- Feature flags intencionalmente desligadas por padrão: `PORTAL_SUBSCRIPTIONS_ENABLED`, `PORTAL_GIFT_REDEMPTION_ENABLED` e `PORTAL_NOTIFICATIONS_ENABLED`. O valor `true` deve ser habilitado somente depois dos testes de homologação correspondentes.
- O painel de Relacionamento agora informa quais credenciais/flags existem, sem expor segredos. 'Configurado' não significa entrega/comprovante homologado.
- Nenhuma cobrança de assinatura, pagamento integral/parcial por vale ou mensagem externa foi efetivamente validada nesta verificação. Não anunciar essas operações como disponíveis em produção.
- Para testar a PR na Vercel, usar uma implantação **preview com banco Neon isolado**, não o mesmo `DATABASE_URL` da produção. O build de produção aplica migrações, portanto confirmar o alvo antes de publicar.
