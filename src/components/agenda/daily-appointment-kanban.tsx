'use client';

import { useMemo, useRef, useState } from 'react';
import styles from './daily-appointment-kanban.module.css';

export type DailyAppointment = {
  id: string; startsAt: string; status: string; customerName: string;
  petName?: string; serviceName?: string;
};
type Props = {
  appointments: DailyAppointment[];
  onOpen: (appointment: DailyAppointment) => void;
  onCreate?: (date: string) => void;
  onStatusChange?: (appointment: DailyAppointment, status: string) => Promise<void> | void;
  statusColumns: { id: string; label: string }[];
  allowedStatuses?: (appointment: DailyAppointment) => readonly string[];
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  showCalendar?: boolean;
  loading?: boolean;
};
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export default function DailyAppointmentKanban({ appointments, onOpen, onCreate, onStatusChange,
  statusColumns, allowedStatuses, selectedDate, onDateChange, showCalendar = true, loading = false }: Props) {
  const [localDate, setLocalDate] = useState(() => dateKey(new Date()));
  const selected = selectedDate ?? localDate;
  const month = new Date(selected + 'T12:00:00');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  function choose(day: string) { setLocalDate(day); onDateChange?.(day); }
  const keyFor = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : dateKey(new Date(value));
  const daily = useMemo(() => appointments.filter(a => keyFor(a.startsAt) === selected)
    .sort((a,b) => a.startsAt.localeCompare(b.startsAt)), [appointments, selected]);
  const counts = new Map<string, number>();
  appointments.forEach(a => {const key=keyFor(a.startsAt);counts.set(key,(counts.get(key)||0)+1)});
  const columns = [...statusColumns];
  daily.forEach(a => {if(!columns.some(c=>c.id===a.status)) columns.push({id:a.status,label:a.status})});
  async function move(item: DailyAppointment, status: string) {
    if (!onStatusChange || lock.current || item.status === status) return;
    lock.current=true;setBusy(true);setError('');
    try { await onStatusChange(item,status); }
    catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar o status. Tente novamente.'); }
    finally { lock.current=false;setBusy(false); }
  }
  return <section className={styles.agenda} aria-label="Calendário e Kanban diário" aria-busy={loading || busy}>
    {showCalendar && <div className={styles.calendar}>
      <div className={styles.toolbar}>
        <button type="button" aria-label="Mês anterior" onClick={()=>choose(dateKey(new Date(month.getFullYear(),month.getMonth()-1,1)))}>←</button>
        <h2>{month.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2>
        <button type="button" aria-label="Próximo mês" onClick={()=>choose(dateKey(new Date(month.getFullYear(),month.getMonth()+1,1)))}>→</button>
        <button type="button" onClick={()=>choose(dateKey(new Date()))}>Hoje</button>
      </div>
      <div className={styles.days}>
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><span key={d}>{d}</span>)}
        {Array.from({length:new Date(month.getFullYear(),month.getMonth(),1).getDay()},(_,i)=><span key={'empty'+i}/>)}
        {Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i)=>{
          const key=dateKey(new Date(month.getFullYear(),month.getMonth(),i+1));
          return <button key={key} type="button" aria-label={'Ver Kanban de '+key.split('-').reverse().join('/')}
            aria-pressed={selected===key} onClick={()=>choose(key)}>
            <strong>{i+1}</strong><small>{!loading && counts.get(key) ? counts.get(key)+' ag.':'\u00a0'}</small>
          </button>;
        })}
      </div>
    </div>}
    <div className={styles.toolbar}>
      <h2>Kanban diário · {selected.split('-').reverse().join('/')}</h2>
      {onCreate && <button type="button" onClick={()=>onCreate(selected)}>+ Agendar neste dia</button>}
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loading ? <p role="status">Carregando agendamentos…</p> : <div className={styles.board}>
      {columns.map(column=>{
        const entries=daily.filter(a=>a.status===column.id);
        return <section key={column.id} className={styles.column}>
          <h3>{column.label} <span>{entries.length}</span></h3>
          {!entries.length && <p className={styles.empty}>Nenhum agendamento</p>}
          {entries.map(item=>{
            const allowed=allowedStatuses?.(item) ?? statusColumns.map(c=>c.id);
            return <article key={item.id} className={styles.card}>
              <button type="button" className={styles.open} onClick={()=>onOpen(item)}>
                <time dateTime={item.startsAt}>{/^\d{4}-\d{2}-\d{2}$/.test(item.startsAt)?'Sem horário':new Date(item.startsAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time>
                <strong>{item.petName || item.customerName}</strong><span>{item.customerName}</span><span>{item.serviceName || 'Serviço'}</span>
              </button>
              {onStatusChange && allowed.length>0 && <label>Status
                <select aria-label={'Status de '+item.customerName} value={item.status} disabled={busy}
                  onChange={e=>void move(item,e.target.value)}>
                  <option value={item.status}>{column.label}</option>
                  {statusColumns.filter(c=>c.id!==item.status && allowed.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>}
            </article>;
          })}
        </section>;
      })}
    </div>}
  </section>;
}
