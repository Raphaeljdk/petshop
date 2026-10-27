# Continuidade da PR 106 — trabalho em andamento

Este checkpoint NÃO libera transmissão, NÃO altera rotas de emissão e NÃO constitui
um emissor concluído. Nenhum dado fiscal do cliente foi aprovado por este código.

## Implementado neste checkpoint

- Pacote oficial PL_010g_v1.03 (publicação 26/10/2026), baixado do Portal Nacional.
  `schemas/nfe/manifest.json` registra origem e hashes SHA-256 dos arquivos.
  Entradas de serviços inalteradas foram obtidas do pacote completo PL_009q;
  incluem o leiaute atualizado 010g, sem modificar o conteúdo dos XSD oficiais.
- Validador XSD offline com verificação de integridade, bloqueio de DTD/entidades,
  limite de tamanho e mensagens sem reprodução dos dados privados do XML.
- Gerador independente PIS/COFINS: Aliq, Qtde, NT e Outr (incluindo CST49),
  valores explícitos, cálculo inteiro e conferência do arredondamento monetário.
- Testes de cálculo, incompatibilidade de CST, dados ausentes e XSD.

## Ainda falta

Integrar esses módulos ao XML completo e ao painel; assinatura XMLDSig/A1 com
verificação de titularidade; persistência isolada e criptografada; reserva atômica
e idempotência; autorização/recibo/consulta e recuperação após timeout; testes de
concorrência e integração; build e publicação verificados. Não usar os auxiliares
como autorização de envio. O diagnóstico existente permanece bloqueado.

## Pendências de entrada

Confirmação do contador: CRT/IE/credenciamento, endereço e município do emitente;
NCM/origem/GTIN/CEST/ST/FCP; CFOP/CSOSN; CST e modalidade de cálculo de PIS/COFINS,
base ou quantidade, alíquota e valor de cada contribuição; aplicabilidade e dados
de IPI/IBS/CBS; referência, responsável e vigência da aprovação. Também faltam
destinatário/endereço/indicador IE, quantidade e valor do ensaio, pagamento/frete,
e série/próximo número de homologação aprovados após conciliação do histórico.
Não deduzir 1085 a partir da maior nota conhecida 1084.
