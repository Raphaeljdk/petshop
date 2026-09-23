'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ShieldCheck, Syringe } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { Button } from '@/components/ui/button'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'

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
  const [erro, setErro] = useState(false)

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
      .catch((error) => { console.error('vacinas cliente erro:', error); if (active) setErro(true) })
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
          Acompanhe o histórico de vacinação dos seus pets.
        </p>
      </div>

      {loading && <SkeletonLoader type="list" count={4} />}

      {!loading && erro && <Card><CardContent className="p-6"><p className="font-medium">Não foi possível carregar as vacinas</p><p className="mt-1 text-sm text-muted-foreground">Atualize a página ou entre em contato com a loja. Seu histórico não foi alterado.</p></CardContent></Card>}

      {!loading && !erro && !linked && (
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="font-medium">Vamos localizar o histórico do seu pet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Precisamos confirmar seu cadastro na loja para exibir seus pets e vacinas com segurança.
            </p>
            <Button asChild className="mt-4 min-h-11 h-auto whitespace-normal"><a href={matilhaWhatsAppUrl('Olá! Já tenho cadastro na Matilha Prado, mas meus pets e vacinas não aparecem no portal. Podem conferir o vínculo da minha conta?')} target="_blank" rel="noreferrer">Pedir ajuda com meu cadastro</a></Button>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && linked && vacinas.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            <Syringe className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="font-medium">Nenhuma vacina registrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Se seu pet já recebeu vacinas na loja, fale com a equipe para conferir o histórico.
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
