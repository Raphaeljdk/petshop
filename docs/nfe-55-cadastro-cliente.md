# Matilha Prado — o que o cliente precisa preencher para NF-e modelo 55

**Atualizado em outubro/2026.** Esta configuração é para NF-e (mercadorias), não para NFC-e modelo 65 (cupom) nem NFS-e (serviços). A SEFAZ-SP exige autorização e a legislação vigente deve ser confirmada com contador responsável.

## Uma vez por empresa — menu Fiscal e Notas > Dados do emitente
- Razão social (conforme cadastro fiscal), nome fantasia, CNPJ, inscrição estadual.
- CRT/regime tributário validado pelo contador (1, 2 ou 3).
- Logradouro, número, bairro, cidade, UF, CEP de 8 dígitos e código IBGE do município de 7 dígitos.
- Série e sequência de NF-e: consultar notas já autorizadas, canceladas ou inutilizadas nos outros emissores para não repetir número. A primeira versão do formulário usa número manual **apenas em homologação e não reserva numeração**.
- Verificar credenciamento NF-e na SEFAZ-SP e validade do certificado A1 ICP-Brasil do estabelecimento. **Nunca enviar PFX ou senha no chat, planilhas ou frontend.**

## Uma vez por produto — menu Fiscal e Notas > Tributação dos produtos
- NCM (8 dígitos), CEST (quando aplicável), origem, unidade comercial/tributável, CFOP de acordo com tipo de saída/UF, CST do regime normal ou CSOSN do Simples.
- GTIN/EAN válido ou declaração `SEM GTIN` quando aplicável; não escolher `SEM GTIN` automaticamente sem verificar.
- Tributos conforme contador: ICMS, FCP, ICMS-ST, IPI, PIS, COFINS e os grupos IBS/CBS/cClassTrib/tributação específica para as regras de 2026.
- Não copiar cegamente CFOP e tributos para todas as vendas; podem mudar por destinatário, regime, UF e natureza da operação.

## Por venda — pedido do site ou Amazon
- Nome e documento CPF/CNPJ do destinatário, inscrição estadual e indicador de contribuinte quando aplicável; endereço separado em rua, número, bairro, município, UF, CEP e IBGE.
- Itens, quantidades, preços, descontos e frete: vêm da venda, mas precisam conferir os totais em centavos.
- Modalidade de frete, pagamento real e natureza da operação. Não atribuir PIX automaticamente sem verificar a transação.
- Decidir modelo e operação: loja presencial pode exigir NFC-e 65; serviços NFS-e. Notas Mercado Livre já existentes precisam ser conciliadas para não duplicar.

## Implementado na PR #94 — apenas rascunho estrutural em homologação
- A tela monta o namespace nacional `http://www.portalfiscal.inf.br/nfe` com `NFe > infNFe versao="4.00"` e `ide/emit/dest/det/total/transp/pag`.
- Gera chave de 44 dígitos com DV apenas para teste **sem reservar número**.
- Cenário atual deliberadamente limitado: CRT 1, CSOSN 102/103/300/400, PIS/COFINS NT CST 04–09, operações internas em SP, pagamentos dinheiro/PIX/transferência, destinatário não contribuinte, sem certificado.
- Exporta arquivo com indicação de **RASCUNHO / SEM VALIDADE FISCAL**. Não se deve carregar esse XML num autorizador nem atribuir a ele status de nota emitida.
- Ainda faltam: revisão contábil, todas as regras por operação, grupos de IBS/CBS exigidos em 2026, validação XSD do pacote 010f, assinatura XMLDSig com A1, reserva idempotente de série/número, envio em homologação, consulta/armazenamento do protocolo, DANFE, eventos, contingência e só então produção.

## Fontes oficiais
- Portal Nacional NF-e — esquemas XML (pacote 010f publicado 31/08/2026): https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w%3D
- MOC e anexos: https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=ndIjl+iEFdE%3D
- Credenciamento SP: https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/PaginaGuiaDoUsuario.aspx
