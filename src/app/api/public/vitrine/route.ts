import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { listarServicosParaConfiguracao } from '@/lib/catalogo-servicos-matilha'

export const dynamic = 'force-dynamic'
async function publicCoupons(now: Date) {
  const codes = (process.env.MATILHA_CUPONS_PUBLICOS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!codes.length) return []
  const rows = await db.cupom.findMany({
    where: {
      codigo: { in: codes },
      ativo: true,
      AND: [
        { OR: [{ inicioEm: null }, { inicioEm: { lte: now } }] },
        { OR: [{ fimEm: null }, { fimEm: { gte: now } }] },
      ],
    },
    select: {
      codigo: true,
      descricao: true,
      tipoDesconto: true,
      valor: true,
      valorMinimo: true,
      fimEm: true,
      limiteUsos: true,
      _count: { select: { usos: true } },
    },
  })
  return rows
    .filter((r) => r.limiteUsos === null || r._count.usos < r.limiteUsos)
    .map(({ limiteUsos, _count, ...publicFields }) => publicFields)
}
async function servicePrices() {
  const services = listarServicosParaConfiguracao(await db.servicoEsteticoConfig.findMany())
  const prices: Record<string, { min: number; max: number }> = {}
  for (const service of services) {
    if (!service.confirmado || !service.gruposConfirmados) continue
    const values = service.gruposPorte.flatMap((g) =>
      g.racas.length && g.duracaoMinutos !== null && g.precoCentavos !== null
        ? [g.precoCentavos / 100]
        : [],
    )
    if (values.length) prices[service.nome] = { min: Math.min(...values), max: Math.max(...values) }
  }
  return prices
}
export async function GET() {
  const [plans, coupons, services] = await Promise.allSettled([
    db.portalCarePlan.findMany({
      where: { active: true },
      select: {
        id: true,
        title: true,
        description: true,
        sessions: true,
        durationDays: true,
        priceCents: true,
      },
      orderBy: [{ priceCents: 'asc' }, { id: 'asc' }],
    }),
    publicCoupons(new Date()),
    servicePrices(),
  ])
  // An approved, explicit equivalence is required to compare a plan with a single service.
  let equivalent: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(process.env.MATILHA_PLANOS_EQUIVALENTES || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) equivalent = parsed
  } catch {}
  const publicPlans =
    plans.status === 'fulfilled'
      ? plans.value.map((plan) => {
          const label = equivalent[plan.id]
          const range =
            typeof label === 'string' && services.status === 'fulfilled'
              ? services.value[label]
              : undefined
          if (!range || range.min !== range.max || plan.sessions <= 0) return plan
          const unit = range.min
          const savingsCents = Math.round(unit * 100) * plan.sessions - plan.priceCents
          return savingsCents > 0 ? { ...plan, savingsCents, comparedService: label } : plan
        })
      : null
  return NextResponse.json(
    {
      plans: publicPlans,
      coupons: coupons.status === 'fulfilled' ? coupons.value : null,
      services: services.status === 'fulfilled' ? services.value : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
