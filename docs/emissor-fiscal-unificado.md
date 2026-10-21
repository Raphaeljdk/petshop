# Emissão fiscal central — estado atualizado em outubro de 2026

## Correção de provedor
**A Nuvem Fiscal anunciou oficialmente o encerramento do serviço em 31/07/2026.** Removemos os links e endpoints de configuração do ERP. Não contrate nem cadastre mais credenciais nesse serviço.

Fontes:
- https://www.nuvemfiscal.com.br/form-sub/
- https://doc.focusnfe.com.br/reference/ambiente
- https://doc.focusnfe.com.br/reference/autenticacao
- https://developer-docs.amazon.com/sp-api/docs/invoices-api-v2024-06-19-reference

## Provedor universal atual sugerido
Focus NFe é alternativa ativa com suporte REST para NF-e 55, NFC-e 65 e NFS-e.
- Conta: https://focusnfe.com.br/
- Documentação: https://doc.focusnfe.com.br/
- Autenticação: Basic `Base64(token:)`; há tokens separados de homologação e produção.
- Ambientes: https://homologacao.focusnfe.com.br e https://api.focusnfe.com.br
- Salvar na Vercel apenas em **Environment Variables**:
  - `FOCUS_NFE_TOKEN_HOMOLOGACAO` (se disponibilizado)
  - `FOCUS_NFE_TOKEN_PRODUCAO` (após contratar e configurar empresa)
- O botão **Testar Focus NFe** usa um GET somente leitura para localizar o CNPJ cadastrado na API. Ele **não emite nota**, mas informa se NF-e/NFC-e/NFS-e estão habilitadas no provedor.
- A emissão oficial depende de implantação do JSON tributário completo, classificação de NCM/CFOP/CST, numeração, pagamentos, frete, IBS/CBS quando exigidos, teste de homologação, revisão do contador, armazenamento privado de XML e confirmação explícita de primeira emissão. Essas etapas não estão liberadas.

## Amazon
O ERP está configurado com variáveis `AMAZON_SP_API_*` da Vercel.
Isso **não** equivale à permissão restrita `Tax Invoicing` da API de notas FBA e não autoriza emissão fiscal no nome do CNPJ.
- Vá em **Fiscal e Notas → Testar notas Amazon FBA**. Resultado de sucesso significa que a permissão de leitura funcionou para as notas FBA daquele momento. Se retornar HTTP 403, configure a função `Tax Invoicing (Restricted)` no Developer Central e reautorize o app.
- A API Invoices da Amazon é exclusivamente de **consulta/exportação de documentos FBA**. A maioria dos pedidos FBM enviados pelo vendedor deve usar emissor externo escolhido.
- Notas Amazon já existentes devem ser conciliadas pelo número/chave antes de tentar emitir outra para o mesmo pedido.

## Mercado Livre
- Faturador Mercado Livre já está configurado pelo dono da conta e a API de consulta foi implementada.
- Antes da primeira emissão efetiva pelo botão, exigir permissão funcional Faturamento (escrita) na aplicação OAuth, consulta da nota existente e confirmação.
- O app precisa continuar bloqueando duplicidade; não ativar bypass da flag de produção.

## Operação no painel do ERP
- **Validar para emitir** está disponível em todos os pedidos e apenas apresenta pendências, sem transmitir.
- Vendas `site` e `amazon` e vendas de mercadorias no Hub: NF-e 55 quando cabível. `loja` presencial: NFC-e 65 conforme legislação e operação. Serviços: considerar NFS-e.
- Situação sem autorização: exibir **rascunho**. Nunca fabricar DANFE, XML, número, protocolo ou chave de acesso.
- Falta o campo de código IBGE do município: para emitente configurado como **São Paulo / SP**, o painel sugere `3550308` com ação de preencher, sem gravar até administrador salvar após conferir os dados.
- Se usuário vê "Rascunho registrado" para Amazon e apenas botões ML, conferir se domínio de produção está no commit que implementou a interface universal; pressionar Ctrl+F5 e atualizar autenticação. Não confundir cache de captura antiga com versão de código.

## Próximo passo antes de transmissão real para todos os canais
1. Escolher um emissor API ativo (Focus NFe, PlugNotas ou outro validado pelo contador).
2. Configurar CNPJ, certificado A1, NF-e 55, NFC-e 65 e regras tributárias no emissor.
3. Verificar o token com uma consulta somente leitura.
4. Fazer um teste completo em **homologação** utilizando pedido fictício e dados permitidos, sem lançar documento real.
5. Homologar sistema, conciliar documentos já existentes na Amazon/ML, implementar a máquina de estados da nota e retentativas seguras.
6. Só então fazer a primeira emissão de produção acompanhada pelo responsável fiscal.
