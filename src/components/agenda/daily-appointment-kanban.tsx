"use client";

import { useMemo, useState } from "react";

export type DailyAppointment = {
  id: string;
  startsAt: string;
  customerName: string;
  petName?: string | null;
  serviceName?: string | null;
  status: string;
};

type Props = {
  appointments: DailyAppointment[];
  onOpen: (appointment: DailyAppointment) => void;
  onCreate?: (date: string) => void;
  onStatusChange?: (appointment: DailyAppointment, status: string) => Promise<void> | void;
  statusColumns?: { id: string; label: string }[];
};

const defaultColumns = [
  { id: "SCHEDULED", label: "Agendado" },
  { id: "CONFIRMED", label: "Confirmado" },
  { id: "IN_PROGRESS", label: "Em atendimento" },
  { id: "COMPLETED", label: "Concluído" },
  { id: "CANCELLED", label: "Cancelado" },
];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function appointmentDate(value: string) {
  // YYYY-MM-DD values are local calendar dates, not UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return dateKey(new Date(value));
}

export default function DailyAppointmentKanban({
  appointments,
  onOpen,
  onCreate,
  onStatusChange,
  statusColumns = defaultColumns,
}: Props) {
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of appointments) {
      const key = appointmentDate(item.startsAt);
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  }, [appointments]);

  const daily = useMemo(
    () => appointments.filter((item) => appointmentDate(item.startsAt) === selected)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [appointments, selected]
  );

  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  async function move(item: DailyAppointment, status: string) {
    if (!onStatusChange || item.status === status) return;
    setError("");
    setBusy(item.id);
    try {
      await onStatusChange(item, status);
    } catch {
      setError("Não foi possível atualizar o status. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Agenda e Kanban diário" className="space-y-5">
      <div className="rounded-xl border p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
          <h2 className="font-semibold capitalize">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
          <button type="button" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span key={day}>{day}</span>)}
          {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
          {Array.from({ length: days }, (_, index) => {
            const key = dateKey(new Date(month.getFullYear(), month.getMonth(), index + 1));
            return <button type="button" key={key} aria-pressed={selected === key}
              onClick={() => setSelected(key)}
              className={`min-h-12 rounded-lg border p-1 hover:bg-slate-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${selected === key ? "border-blue-500 bg-blue-500/15" : "border-transparent"}`}>
              <span className="block">{index + 1}</span>
              {(counts.get(key) ?? 0) > 0 && <span className="text-[10px]">{counts.get(key)} ag.</span>}
            </button>;
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Agendamentos — {selected.split("-").reverse().join("/")}</h2>
        {onCreate && <button type="button" onClick={() => onCreate(selected)} className="rounded-lg border px-3 py-2">+ Novo agendamento</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {statusColumns.map((column) => {
          const items = daily.filter((item) => item.status === column.id);
          return <section key={column.id} className="min-w-0 rounded-xl border bg-slate-500/5 p-3">
            <h3 className="mb-3 font-semibold">{column.label} ({items.length})</h3>
            <div className="space-y-2">
              {items.length === 0 && <p className="text-sm opacity-60">Nenhum agendamento</p>}
              {items.map((item) => <article key={item.id} className="rounded-lg border bg-white/5 p-3">
                <button type="button" className="w-full text-left" onClick={() => onOpen(item)}>
                  <strong className="block">{item.customerName}</strong>
                  <span className="block text-sm">{item.petName || "Pet não informado"} · {item.serviceName || "Serviço"}</span>
                  <time className="text-sm">{/^\d{4}-\d{2}-\d{2}$/.test(item.startsAt) ? "Horário não informado" : new Date(item.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                </button>
                {onStatusChange && <label className="mt-2 block text-xs">Status
                  <select aria-label={`Status de ${item.customerName}`} value={item.status} disabled={busy === item.id}
                    onChange={(event) => void move(item, event.target.value)}
                    className="mt-1 w-full rounded border bg-transparent p-2">
                    {!statusColumns.some((status) => status.id === item.status) && <option value={item.status}>{item.status}</option>}
                    {statusColumns.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                  </select>
                </label>}
              </article>)}
            </div>
          </section>;
        })}
      </div>
    </section>
  );
}
