'use client'

import { useMemo } from 'react'
import { CalendarDays, Clock3, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'

const DAY_FORMATTER = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function AtendimentoMenu() {
  const days = useMemo(() => {
    const now = new Date()

    return Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now)
      date.setHours(12, 0, 0, 0)
      date.setDate(now.getDate() + index)

      const isoDate = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-')

      return {
        isoDate,
        label:
          index === 0
            ? 'Hoje'
            : index === 1
              ? 'Amanhã'
              : capitalize(DAY_FORMATTER.format(date).replace('.', '')),
        dateLabel: DATE_FORMATTER.format(date),
      }
    })
  }, [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary">
          <CalendarDays className="size-4" />
          Atendimento
        </button>
      </PopoverTrigger>

      <PopoverContent align="center" className="w-[340px] p-0 sm:w-[390px]">
        <div className="border-b bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock3 className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Horário de atendimento</p>
              <p className="text-xs text-muted-foreground">Das 09h às 20h</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Escolha um dia abaixo para consultar os horários disponíveis com a equipe.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {days.map((day) => (
              <a
                key={day.isoDate}
                href={matilhaWhatsAppUrl(
                  `Olá! Vim pelo site da Matilha Prado e gostaria de consultar os horários disponíveis para atendimento em ${day.dateLabel}. Pode me informar os horários livres entre 09h e 20h?`
                )}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-border bg-background p-3 transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{day.label}</p>
                    <p className="text-[11px] text-muted-foreground">{day.dateLabel}</p>
                  </div>
                  <MessageCircle className="mt-0.5 size-4 text-green-600" />
                </div>
                <p className="mt-2 text-[11px] font-medium text-primary">09h às 20h</p>
                <p className="text-[10px] text-muted-foreground">Consultar disponibilidade</p>
              </a>
            ))}
          </div>

          <Button asChild className="mt-4 w-full">
            <a
              href={matilhaWhatsAppUrl(
                'Olá! Vim pelo site da Matilha Prado e gostaria de consultar os próximos dias e horários disponíveis para atendimento.'
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-4" />
              Consultar outro dia
            </a>
          </Button>

          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
            Os horários livres são confirmados pela equipe no WhatsApp.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
