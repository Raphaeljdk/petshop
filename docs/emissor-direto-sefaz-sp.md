# Emissor próprio NF-e 55 — SEFAZ São Paulo (sem provedor por nota)

## Objetivo
Substituir dependência de emissores pagos para notas de mercadorias vendidas no site e, depois de reconciliação, nos marketplaces; usar integração direta SEFAZ-SP.

## Fontes oficiais, outubro/2026
- Credenciamento NF-e SP e requisitos A1: https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/PaginaGuiaDoUsuario.aspx
- Web Services oficiais NF-e 4.00 (autorização, consulta, status, retorno e eventos; homologação/produção separados):
  https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/URL-WEBSERVICES.aspx
- Schemas XML 010f (31/08/2026) e NT 2025.002 v1.50 + NT 2026.007:
  https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w%3D
- Manual de Orientação do Contribuinte:
  https://www.nfe.fazenda.gov.br/portal/principal.aspx

## Primeira etapa implementada
- API interna autenticada em `GET/POST /api/admin/fiscal/provedor` mostra diagnóstico e faz uma única consulta **NFeStatusServico4 no ambiente de HOMOLOGAÇÃO** com certificado ICP-Brasil A1, via TLS mútuo; nenhum XML de nota fiscal é gerado ou transmitido.
- POST verifica CNPJ e UF SP no banco; apenas ADMIN e origem do próprio ERP; host fixo; timeout e limite de tamanho; retorna código `107` como serviço operacional e jamais como NF-e autorizada.
- Segredos armazenados só no backend da Vercel (ver abaixo), jamais enviados ao browser ou salvos no banco, chat ou GitHub.
- O teste valida abertura do PFX/TLS, **não** comprova que o CNPJ dentro do certificado corresponde ao emitente nem que ele está credenciado.

## Como configurar com segurança
1. O representante legal verifica na SEFAZ-SP se o estabelecimento está credenciado. Em regra, contribuintes não MEI já estão credenciados automaticamente.
2. Obter o arquivo A1 em formato `.pfx`/`.p12` e senha diretamente da empresa, sem enviar por chat. O certificado usado no Mercado Pago poderá ser reutilizado, se o dono disponibilizar uma cópia exportável autorizada.
3. Em equipamento confiável, converter **localmente** o PFX para Base64. Exemplo Windows PowerShell (sem imprimir o conteúdo na tela):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\\caminho\\certificado.pfx")) | Set-Clipboard
   ```
4. Vercel > projeto `petshop` > Settings > Environment Variables. Salvar em **Production**:
   - `SEFAZ_NFE_A1_PFX_BASE64`: conteúdo Base64 (proteger como Secret)
   - `SEFAZ_NFE_A1_SENHA`: senha do certificado, protegida
   - Não usar prefixo `NEXT_PUBLIC_`.
5. Fazer novo deploy para carregar variáveis. ERP > Fiscal e Notas > **Testar SEFAZ-SP (homologação)**.
6. Resultado esperado: `cStat=107` (serviço operando); esse teste NÃO emite nota nem demonstra autorização de emissão.

## Fases de implementação fiscal ainda necessárias
- Validação formal do vínculo entre CNPJ do emitente e ICP-Brasil A1, validade e cadeia de confiança.
- Garantir destinatário, endereço estruturado, produtos NCM/CFOP por tipo de operação, CEST/ICMS-ST quando aplicável, GTIN, regras Simples Nacional, PIS/COFINS e IBS/CBS 2026.
- Gerar XML NF-e v4.00 com todos os campos do schema oficial vigente, assinar XMLDSig enveloped e validar XSD. Nunca presumir autorização.
- Reservar série e número atomicamente sem conflito com emissões anteriores do Mercado Pago/Mercado Livre; conciliar chave, NF-e, XML, protocolo de autorização e reprocessamento após timeout.
- Homologação real NF-e de teste na SEFAZ, após revisão com contador, via NFeAutorizacao4 e consulta recibo/protocolo.
- Persistir documentos XML autorizados e protocolos em armazenamento privado, desenvolver DANFE, cancelamento, inutilização e carta de correção.
- Só então liberar primeira emissão real em produção, com autorização fiscal e confirmação humana.
- NFC-e 65 e NFS-e são projetos diferentes. Não usar serviço de NF-e 55 para emissão de serviços.

## Limitação de custo
Sem mensalidade por nota de um intermediário **não** significa custo zero. Permanecem custos do A1, hospedagem, segurança, suporte e manutenção contínua dos esquemas fiscais.
