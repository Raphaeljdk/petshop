export type CarePlan = {
  id: string
  title: string
  description: string
  sessions: number
  durationDays: number
  priceCents: number
  savingsCents?: number
  comparedService?: string
}
export type PublicCoupon = {
  codigo: string
  descricao: string | null
  tipoDesconto: string
  valor: number
  valorMinimo: number
  fimEm: string | null
}
export type ShopInfo = {
  plans: CarePlan[] | null
  coupons: PublicCoupon[] | null
  services: Record<string, { min: number; max: number }> | null
}
export type Season = 'natal' | 'pascoa' | 'halloween'
export const seasonalCampaigns: Record<
  Season,
  { label: string; title: string; destination: 'novidades' | 'ofertas' }
> = {
  natal: { label: 'Natal da Matilha', title: 'Presentes para o seu pet', destination: 'novidades' },
  pascoa: { label: 'Páscoa da Matilha', title: 'Descubra os mimos da loja', destination: 'novidades' },
  halloween: {
    label: 'Halloween da Matilha',
    title: 'Explore as ofertas da loja',
    destination: 'ofertas',
  },
}
export function activeSeason(): Season | null {
  const season = process.env.NEXT_PUBLIC_MATILHA_CAMPANHA
  return season && Object.hasOwn(seasonalCampaigns, season) ? (season as Season) : null
}
