# NF-e 55 — intermediador e envio por e-mail (Matilha Prado)

## Rejeição cStat 434 da NF-e de teste
- Em 17/11/2026, NF-e **série 2, número 2** foi rejeitada com **cStat 434**, mensagem: “NF-e sem indicativo do intermediador”.
- O gerador incluía `indPres=2` (venda não presencial pela internet), mas omitia `indIntermed`.
- Para o teste realizado em **site próprio** sem marketplace, usar `indIntermed=0` após `indPres`. A regra foi validada contra os XSD locais e testes automatizados.
- A classificação do intermediador depende da operação de fato: **Amazon / marketplace exigem `indIntermed=1` + grupo `infIntermed` com identificação correta da plataforma**. O gerador atual bloqueia esse canal até parametrização fiscal; nunca usar `0` para simular venda própria.
- A nota **rejeitada número 2 permanece no histórico**, sem protocolo e sem XML autorizado. Não a alterar nem marcá-la como autorizada; preparar um novo teste corrigido usando próxima numeração na série 2.
- A nota **número 1 permanece incerta** até consulta da chave. Não tratá-la como autorizada.

## Entrega automática ao cliente — apenas depois de autorização REAL
- O job autenticado `/api/cron/nfe-email` é agendado na Vercel a cada cinco minutos.
- **Por padrão fica desabilitado**. Só funciona com `NFE_EMAIL_AUTOMATICO_ENABLED=true`, `RESEND_API_KEY`, `INVITATION_EMAIL_FROM` e `APP_URL` HTTPS válidos, além de `CRON_SECRET`.
- Encontra somente `NotaFiscal` com `modelo=55`, `status=autorizada`, `emissor=matilha_prado`, XML autorizado real com `tpAmb=1`, protocolo válido, chave coerente e e-mail do cliente vinculado à venda.
- Um registro `NfeEmailDelivery` único por nota impede disparos duplicados. O Resend recebe chave de idempotência por nota. Após erro/timeout, exige revisão manual de entrega (não reenvia sem verificar o provedor).
- O e-mail entrega o **XML oficial autorizado em anexo**. O PDF DANFE depende de geração/armazenamento válido e **ainda não está implementado** neste fluxo; não anexar PDF de rascunho ou criar documento com aparência de oficial.
- Nunca envia e-mails a clientes para `NfeHomologacao`, NF-e de teste, notas rejeitadas, notas de marketplace externo ou sem documento autorizado.
- Não ativa emissão de produção: o emissor real continuará bloqueado até homologação ponta a ponta, conciliação da numeração e revisão contábil.
- Quando a autorização em produção for implantada, registrar emissão própria como `emissor='matilha_prado'`; o worker de e-mails somente atuará depois da autorização e registro do XML com protocolo.

## Requisitos adicionais para liberar produção
1. Obter primeira autorização com cStat 100 e XML autorizado em homologação.
2. Validar campos fiscais e meios de pagamento com contador, inclusive adequações vigentes de IBS/CBS.
3. Implementar fluxo real seguro de autorização, cancelamento, inutilização, consulta e armazenamento.
4. Gerar e disponibilizar o DANFE PDF verdadeiro, adequado ao documento autorizado, para anexar também ao e-mail.
5. Habilitar o envio automático só depois de validar remetente e fazer teste controlado com o destinatário autorizado.

## Release de código
- CI da PR #148 aprovado (Release build, Authentication checks, Client invitation checks).
- Módulos fiscal e envio por e-mail incorporados à branch main; envio automático continua desabilitado até configuração do remetente, autorização real e validação operacional.
