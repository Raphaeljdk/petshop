# Auditoria documental — 04/11/2026
**Tipo:** auditoria estática, sem execução de build, testes, consulta ao Neon de produção ou consulta ao deploy Vercel.  
**Conclusão:** documentação **parcial**; foi criado índice e inventário central sem modificar comportamento do sistema.

## Critério
Inspecionados: árvore do repositório `main` (599 entradas), títulos dos documentos em `docs/`, README, `package.json`, guia de experiência do cliente, pendências de entrega, plano da primeira NF-e e modelos Prisma.

## Achados e ações pendentes
| Prioridade | Achado | Ação / evidência para encerrar |
| --- | --- | --- |
| Crítica | O README afirma que migração não roda no build da Vercel, mas `package.json` usa `db:deploy:production` e `db:bootstrap:kanban:production` em `build`, inclusive baseline de produção. | Revisar política de migrações e risco de perda/alteração; conciliar README e scripts, testar em branch isolada e exigir backup e rollback antes de qualquer execução em produção. |
| Crítica | NF-e própria modelo 55 não possui comprovação nesta auditoria de XML assinado, XSD validado, cStat 100 e protocolo em homologação. | Seguir `primeira-nfe-homologacao-matilha-prado.md`, registrar evidências e aprovação contábil antes da produção. |
| Alta | Existem componentes de Kanban, mas não há evidência nesta auditoria de que a navegação, API, gravação e uso em produção estejam integrados. | Teste ponta a ponta: criar/mudar status/recarregar/validar isolamento de usuários e banco. |
| Alta | Documentação do Siggma/Zetta no README contém orientações históricas conflitantes sobre TLS (primeiro obrigatório, depois não exigido). | Obter orientação atual do fornecedor e registrar política de transporte seguro e data da decisão, sem desativar validações por inferência. |
| Alta | Documentos fiscais históricos convivem com mudanças na regra tributária e tabelas ainda dependentes de contadora. | Consolidar matriz fiscal validada, com fonte, data, UF, operação, produto e responsável; não assumir CFOP, CSOSN, CST, NCM ou CEST pelo histórico. |
| Alta | Integrações Mercado Livre, Amazon, Mercado Pago, Melhor Envio, Zetta/Siggma dependem de configuração e credenciais externas. | Registrar por integração: ambiente, escopo de token, webhook, teste de falha, rate-limit, retries, logs, responsável e data da última validação. |
| Média | APIs numerosas sem contrato único consolidado. | Gerar catálogo OpenAPI/rota por rota com método, papel, parâmetros, erros e exemplos sintéticos; revisar manualmente antes de publicar. |
| Média | Não há manual central de operação da equipe que cubra todos os módulos. | Criar procedimentos com capturas autorizadas, permissões por papel, roteiros para agenda, estoque, vendas, devolução e emissão fiscal. |
| Média | Falta matriz central de qualidade: requisitos ↔ testes ↔ evidências ↔ status deploy. | Rodar lint, typecheck, testes, build em ambiente isolado; registrar SHA, Vercel deployment e resultado. |
| Média | Falta runbook central de backup, restauração, incidente e rotação de credenciais. | Definir RPO/RTO, ensaiar restauração, especificar controles de acesso e retenção LGPD. |
| Média | Documentação de dashboard precisa identificar métricas e origem de cada canal. | Distinguir faturamento efetivo, pedidos, NF-e autorizadas, cancelamentos e duplicidades entre marketplace e Hub. |

## Matriz de validação antes de declarar entregue
- [ ] Confirmar fluxos de login de cliente e administrador; expiração e revogação de convites.
- [ ] Validar permissões e isolamento dos dados de dois clientes distintos.
- [ ] Confirmar pedidos, checkout e webhook Mercado Pago sem cobranças duplicadas.
- [ ] Testar estoque unificado e deduplicação entre anúncios e SKUs.
- [ ] Testar agenda, status e Kanban após reload e em dois dispositivos.
- [ ] Confirmar dados de dashboard com amostra reconciliada.
- [ ] Testar cotação Melhor Envio com cenários válidos e inválidos.
- [ ] Executar emissão de NF-e exclusivamente em homologação sob aprovação; jamais assumir homologação concluída.
- [ ] Registrar validação contábil dos códigos fiscais e histórico de numeração/série de todos os emissores.
- [ ] Verificar backup, restore, logs, alertas e rollback.
- [ ] Confirmar manual da equipe e aceite do cliente.

## Protocolo de manutenção
Para cada alteração: registrar requisito → código/PR → teste → evidência → ambiente → documentação → aprovação → deploy. Toda evidência deve ter data e SHA do commit. Na ausência de prova, registrar **não verificado**. Não editar dados reais nem configurar segredos apenas para completar documentação.

**Limitação desta revisão:** ela cobre inventário estrutural e amostragem de documentos; não representa leitura linha a linha de todos os 599 itens. Não afirmar que todos os módulos estão corretamente documentados ou homologados.
