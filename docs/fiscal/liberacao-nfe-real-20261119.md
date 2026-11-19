# NF-e Matilha Prado — conciliação, DANFE e entrada controlada em produção (19/11/2026)

## O que foi efetivamente confirmado
- No banco Neon, a NF-e de **homologação** série 2 nº 4 está registrada como `autorizada`, `cStat 100`, com protocolo e XML `nfeProc`. Isso NÃO é uma nota de produção; ainda recomendamos consulta independente da chave na SEFAZ.
- Série 2 nº 1 permanece `incerta`: a consulta da mesma chave na SEFAZ-SP precisa ser executada via área administrativa autenticada. **Não criar uma segunda nota com a mesma operação.** O teste nº 2 recebeu 434 e nº 3 recebeu 391; as correções para novas notas já foram integradas.
- Os registros existentes de NF-e 55 do Mercado Livre na série 1 não são inventário completo de numeração. O maior número importado observado em 19/11 é 1204, mas NÃO equivale ao último número de todos os emissores. Não inferir o número 1205 nem reservar número real por conta própria.
- CRT 1, apuração `PGDAS_D`, A1 e regra aprovada para Arm & Hammer estão configurados. A 2ª faixa do Simples Nacional foi confirmada pelo responsável da empresa; não aplicar os percentuais de repartição diretamente na NF-e.
- O emissor próprio de PRODUÇÃO continua bloqueado: `tpAmb=1` não possui autorização operacional, numeração idempotente fiscal nem eventos de cancelamento concluídos.

## Fluxo para conciliar a NF-e de teste nº 1
1. Entrar como ADMIN > Fiscal e Notas > Pedidos e notas > Histórico isolado de homologação.
2. Localizar série 2 nº 1 e usar **Consultar situação na SEFAZ**. A chamada usa o certificado A1 protegido no backend, sem expor a chave privada.
3. Se retorno com 100/150 e protocolo: registrar e armazenar XML autorizado. Se 217: manter status de consulta não localizada e analisar logs/recibo; reenvio somente do XML assinado ORIGINAL, conforme travas e confirmação da interface. Se timeout, **não reenviar** até reconciliar.
4. Não usar informações de ambiente 2 para liberar produção.

## Auditoria de numeração real
1. Solicitar ao financeiro os XMLs (modelo 55) e eventos de todas as séries utilizadas em produção nos emissores anteriores: Mercado Livre, Amazon, Mercado Pago e outras integrações.
2. Para cada série, conciliar autorizadas, canceladas, denegadas quando aplicável e inutilizadas; confrontar com o registro oficial e com o contador.
3. Conferir a série própria que será destinada ao ERP; a série 2 do teste não implica que a série 2 em produção esteja vazia.
4. Manter bloqueio explícito até que a conferência tenha responsável, data, fonte e último número oficialmente comprovado.
5. Criar controle transacional de reserva de número com `UNIQUE (CNPJ, modelo, série, numero, ambiente)`, idempotência por venda e reconciliação antes de transmitir, para não competir com outros emissores.

## DANFE e e-mail
- Implementado na ramificação: gerador de **PDF A4** a partir do XML `nfeProc` autorizado em PRODUÇÃO com protocolo e chave correspondentes; rota privada ADMIN de download e anexo no Resend. O gerador não transforma rascunho nem teste em documento fiscal.
- A homologação do **layout DANFE** contra exemplos reais, paginação de notas extensas e requisitos fiscais atuais ainda exige inspeção visual e aprovação contábil. Não ativar envio automático antes desse aceite.
- Variáveis de e-mail já usadas: `RESEND_API_KEY`, `INVITATION_EMAIL_FROM`, `APP_URL`, `CRON_SECRET`; envio automático continua dependente de `NFE_EMAIL_AUTOMATICO_ENABLED=true`.
- Realizar um teste controlado de recebimento com uma **nota real já autorizada de emissão própria**; a rotina não deve enviar notas externas ou de homologação.

## Bloqueadores ainda não resolvidos pela ramificação
1. Consulta efetiva da nº 1 na SEFAZ (exige sessão ADMIN e comunicação do serviço).
2. Confirmação **externa** da numeração/série real de produção por todos os emissores.
3. Emissor completo de produção: preparar e assinar XML correto `tpAmb=1`, conferir os dados do pedido/pagamento real, reservar número de modo atômico, transmitir, consultar, registrar protocolo/XML e tratar cancelamento/inutilização/contingência. O gerador legado usado nos testes é restrito a `tpAmb=2`; NÃO mudar por substituição textual.
4. Validação final da contadora para cada cenário de operação, IBS/CBS e requisitos normativos vigentes.
5. Inspeção visual/funcional do DANFE e teste real de e-mail antes de publicação/ativação.

**Não fazer go-live apenas porque a primeira homologação foi autorizada.**
