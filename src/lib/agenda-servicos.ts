/** Tipos de agenda disponíveis somente para a operação interna; não habilitam prestação de serviços clínicos sem profissionais autorizados. */
export const CATEGORIAS_AGENDA = [
  'Cirurgias','Clínicos','Day Care','Estéticos','Externos',
  'Gerais','Hospedagens','Internações','Vacinas','Vermífugos',
] as const
export type CategoriaAgenda = typeof CATEGORIAS_AGENDA[number]

/** Exemplos editáveis pelo operador. Não atribuem preço ou disponibilidade comercial. */
export const SUGESTOES_AGENDA: Record<CategoriaAgenda, readonly string[]> = {
  Cirurgias: ['Avaliação pré-cirúrgica','Procedimento cirúrgico','Retorno pós-cirúrgico'],
  Clínicos: ['Consulta clínica','Exames','Retorno clínico'],
  'Day Care': ['Day Care','Creche pet','Recreação'],
  Estéticos: ['Banho','Tosa','Banho e tosa','Hidratação'],
  Externos: ['Atendimento externo','Busca e entrega','Atendimento domiciliar'],
  Gerais: ['Atendimento geral','Avaliação','Orientação ao tutor'],
  Hospedagens: ['Hospedagem','Entrada na hospedagem','Saída da hospedagem'],
  Internações: ['Internação','Acompanhamento','Alta'],
  Vacinas: ['Vacinação','Reforço de vacina'],
  Vermífugos: ['Vermifugação','Retorno de vermifugação'],
}

export function inferirCategoriaAgenda(servico: string): CategoriaAgenda {
  const s=servico.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  if(/cirurg|castrac|pos.cirurg/.test(s))return 'Cirurgias'
  if(/vacina|imunizac/.test(s))return 'Vacinas'
  if(/vermif|desparasit/.test(s))return 'Vermífugos'
  if(/internac|internad/.test(s))return 'Internações'
  if(/hosped|hotel|pernoite/.test(s))return 'Hospedagens'
  if(/day.?care|creche|recreac/.test(s))return 'Day Care'
  if(/banho|tosa|estetic|hidratac|embelez|unha/.test(s))return 'Estéticos'
  if(/externo|domicili|delivery|transporte/.test(s))return 'Externos'
  if(/clinico|consulta|retorno|exame|avaliac|ultrassom/.test(s))return 'Clínicos'
  return 'Gerais'
}
