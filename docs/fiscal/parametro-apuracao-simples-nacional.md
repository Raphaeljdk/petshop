# Matilha Prado — parâmetro de apuração do Simples Nacional

## Contexto e finalidade
Em 16/11/2026, Aleksander Prado orientou o desenvolvimento a manter a apuração tributária conforme o Simples Nacional, sem configurar impostos diretos/rateio por NF-e que possam levar à cobrança indevida em duplicidade.

## Configuração no ERP
- O cadastro fiscal do emitente contém o parâmetro persistente `apuracaoTributaria`.
- Com CRT 1, o valor aceito é `PGDAS_D`: apuração mensal da receita no PGDAS-D e recolhimento via DAS.
- Fora de CRT 1, o valor permitido neste estágio é `PENDENTE_VALIDACAO`, sem habilitação do emissor próprio.
- A API de edição valida a relação entre CRT e modo de apuração. O backend de NF-e em homologação exige CRT 1 e `PGDAS_D`.
- O painel exibe essa situação dentro de **Dados do emitente**, sem nova aba.
- O parâmetro não liga automaticamente o emissor próprio em produção.

## Regras tributárias e limitações
1. **Não aplicar os percentuais de repartição do Anexo I** como alíquotas de PIS, COFINS, ICMS ou CPP diretamente em cada NF-e, tampouco gerar outra obrigação de pagamento por nota com base nessa repartição.
2. A NF-e deve continuar contendo CRT, CSOSN, CST e os grupos e valores exigidos pela operação e leiaute oficial. **Não zerar indiscriminadamente** impostos de todos os produtos pelo simples fato de a empresa ser do Simples.
3. Para o teste específico do Arm & Hammer 473 ml, a empresa transmitiu orientação de CST 49 com base, alíquota e valor de PIS/COFINS igual a zero e CEST dispensado; não estender a outros produtos sem regra fiscal por operação.
4. Regras de substituição tributária, tributação monofásica, antecipação, diferencial, tributos devidos fora do DAS, desonerações, NFS-e e IBS/CBS devem seguir a legislação vigente e classificação validada, com eventual segregação de receitas no PGDAS-D.
5. **A emissão de uma NF-e não paga automaticamente tributos e não gera o DAS.** O DAS e a escrituração devem conciliar as vendas, notas e receitas sem duplicidade; a conferência da contadora permanece necessária.
6. Não criar retenções tributárias por padrão nas vendas do cenário homologado; para outras situações, depender de regra específica aprovada.
7. A série 2 continua a preferência do emissor próprio; para gerar nota com validade fiscal ainda faltam autorização em homologação e implementação do fluxo de produção (numeração, idempotência, DANFE, retorno SEFAZ).

## Base normativa e consulta
- Resolução CGSN 140/2018, especialmente arts. 16, 25, 38 e 41: https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278
- Receita Federal — Perguntas e Respostas do Simples Nacional, tributação monofásica e ST: https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/PerguntaoSN.pdf
- Portal NF-e — CRT / CSOSN: https://www.nfe.fazenda.gov.br/portal/consulta.aspx/perguntasFrequentes.aspx?tipoConteudo=3Ow1nfTBzIo%3D

## Não altera automaticamente
Estoque, preços, vendas, notas já emitidas, DAS, séries e numeração ou qualquer classificação por produto.
