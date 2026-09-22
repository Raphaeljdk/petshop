'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ShieldCheck, Syringe } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'

type Vacina = {
  id: number
  petId: number
  petNome: string
  descricao: string
  observacoes: string | null
  status: string | null
  terceiros: boolean
  aplicadaEm: string | null
  intervaloDias: number | null
  proximaDoseEm: string | null
}

function dateLabel(value: string | null) {
  if (!value) return 'Data não informada'
  const date = parseISO(value)
  if (!isValid(date)) return 'Data não informada'
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function ClientVacinas() {
  const [vacinas, setVacinas] = useState<Vacina[]>([])
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState(true)

  useEffect(() => {
    let active = true
    void fetch('/api/cliente/vacinas', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Falha ao consultar vacinas')
        return response.json()
      })
      .then((payload) => {
        if (!active) return
        setVacinas(payload.data || [])
        setLinked(payload.linked !== false)
      })
      .catch((error) => console.error('vacinas cliente erro:', error))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [])

  const porPet = useMemo(() => {
    const map = new Map<string, Vacina[]>()
    for (const vacina of vacinas) {
      const list = map.get(vacina.petNome) || []
      list.push(vacina)
      map.set(vacina.petNome, list)
    }
    return [...map.entries()]
  }, [vacinas])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vacinas</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de vacinação dos seus pets sincronizado com o Siggma
        </p>
      </div>

      {loading && <SkeletonLoader type="list" count={4} />}

      {!loading && !linked && (
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="font-medium">Conta ainda não vinculada ao Siggma</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Assim que o cadastro for vinculado ao cliente do ERP, o histórico aparecerá aqui.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && linked && vacinas.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            <Syringe className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="font-medium">Nenhuma vacina registrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Os registros feitos no Siggma aparecerão automaticamente nesta aba.
            </p>
          </CardContent>
        </Card>
      )}

      {porPet.map(([pet, registros]) => (
        <Card key={pet}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Syringe className="size-4 text-primary" />
              {pet}
              <Badge variant="secondary">{registros.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {registros.map((vacina) => (
              <div key={vacina.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{vacina.descricao}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      Aplicada em {dateLabel(vacina.aplicadaEm)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {vacina.status && <Badge variant="outline">{vacina.status}</Badge>}
                    {vacina.terceiros && <Badge variant="secondary">Externa</Badge>}
                  </div>
                </div>

                {vacina.proximaDoseEm && (
                  <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm">
                    <strong>Próxima dose estimada:</strong> {dateLabel(vacina.proximaDoseEm)}
                  </div>
                )}

                {vacina.observacoes && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {vacina.observacoes}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
