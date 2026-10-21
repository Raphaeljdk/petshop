export const appointmentTransitions: Record<string, readonly string[]> = {
  SCHEDULED: ['ARRIVED', 'CANCELLED'], ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [],
};
export function calendarRange(start: string | null, end: string | null) {
  if (!start || !end) throw new Error('Informe início e fim da agenda.');
  const gte = new Date(start), lte = new Date(end);
  if (!Number.isFinite(gte.getTime()) || !Number.isFinite(lte.getTime()) ||
    lte <= gte || lte.getTime()-gte.getTime() > 47*86400000)
    throw new Error('Intervalo inválido; limite de 47 dias.');
  return {gte,lte};
}
export function calendarPage(value: string | null) {
  const page = value === null ? 1 : Number(value);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Página inválida.');
  return page;
}
// Load every page; never silently hide records after the API's page limit.
export async function loadCalendarPages<T>(url: string, signal: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  for (let page=1; page<=10000; page++) {
    const res=await fetch(url+'&pagina='+page,{cache:'no-store',credentials:'same-origin',signal});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error || 'Não foi possível carregar a agenda.');
    if(!Array.isArray(data.items)) throw new Error('Resposta de agenda inválida.');
    items.push(...data.items);
    if(!data.truncado) return items;
    if(!data.items.length) throw new Error('A agenda mudou durante a consulta. Atualize novamente.');
  }
  throw new Error('Intervalo muito grande. Selecione um período menor.');
}
