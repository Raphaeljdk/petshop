import { db } from '@/lib/db'

/**
 * Registra um rascunho de NF-e de forma idempotente para uma venda concluída.
 * NÃO transmite à SEFAZ, NÃO cria XML/chave/protocolo e NÃO marca autorização.
 * Deve ser chamado após persistir a venda/pagamento. Falhas não invalidam o pagamento.
 */
export async function ensureFiscalDraftForSale(vendaId: string) {
  const venda = await db.venda.findUnique({
    where: { id: vendaId },
    select: {
      id: true, status: true, total: true, canal: true,
      itens: { take: 1, select: { id: true } },
    },
  })
  if (!venda || venda.status !== 'concluida' || !(venda.total > 0) || !venda.itens.length) return null
  // Não inferir uma venda online por ter sido registrada em tablet/PDV.
  // Operações presenciais precisam da regra própria de NFC-e (modelo 65).
  if (!['site', 'amazon', 'mercado_livre', 'mercadolivre'].includes(venda.canal)) return null

  const config = await db.configuracaoFiscal.findUnique({
    where: { id: 'matilha-prado' },
    select: { serieNfe: true },
  })
  // A constraint UNIQUE(vendaId) protege contra reenvio de webhook e tarefas simultâneas.
  // update:{} preserva inclusive notas autorizadas ou canceladas anteriormente.
  return db.notaFiscal.upsert({
    where: { vendaId },
    create: { vendaId, modelo: '55', status: 'rascunho', serie: config?.serieNfe || 1 },
    update: {},
    select: { id: true, vendaId: true, status: true },
  })
}
