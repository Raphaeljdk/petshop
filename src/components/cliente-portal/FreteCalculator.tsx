'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  MapPin,
  Loader2,
  Store,
  Truck,
  PackageCheck,
  AlertCircle,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { aplicarMascaraCep, validarCep } from '@/lib/frete-utils'
import type { OpcaoFrete, TipoEntrega } from '@/lib/types'

interface FreteResponse {
  cep: string
  valido: boolean
  dentroSP: boolean
  opcoes: OpcaoFrete[]
  retiradaEndereco: string
}

interface FreteCalculatorProps {
  /** CEP inicial (opcional — ex: CEP já cadastrado do cliente) */
  cepInicial?: string | null
  /** Callback disparado ao selecionar uma opção */
  onSelect: (info: {
    tipoEntrega: TipoEntrega
    valorFrete: number
    prazoEntrega: string
    cepEntrega: string
  }) => void
  /** Callback ao limpar a seleção */
  onClear?: () => void
  /** Compact mode (sem header de card) */
  compact?: boolean
}

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const ICONS: Record<TipoEntrega, React.ComponentType<{ className?: string }>> = {
  retirada: Store,
  entrega_propria: Truck,
  sedex: PackageCheck,
}

export function FreteCalculator({
  cepInicial,
  onSelect,
  onClear,
  compact,
}: FreteCalculatorProps) {
  const [cep, setCep] = useState('')
  const [loading, setLoading] = useState(false)
  const [dados, setDados] = useState<FreteResponse | null>(null)
  const [selecionado, setSelecionado] = useState<TipoEntrega | null>(null)

  // Sincroniza CEP inicial (ex: CEP do cliente logado)
  useEffect(() => {
    if (cepInicial && !cep) {
      setCep(aplicarMascaraCep(cepInicial))
    }
  }, [cepInicial, cep])

  // Limpa seleção quando o CEP muda
  useEffect(() => {
    if (selecionado) {
      setSelecionado(null)
      onClear?.()
    }
  }, [cep])

  const podeCalcular = useMemo(() => validarCep(cep), [cep])

  const calcular = async () => {
    if (!validarCep(cep)) {
      toast.error('CEP inválido. Digite 8 dígitos no formato XXXXX-XXX.')
      return
    }
    setLoading(true)
    setSelecionado(null)
    onClear?.()
    try {
      const res = await fetch(`/api/frete?cep=${encodeURIComponent(cep)}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error()
      const data: FreteResponse = await res.json()
      setDados(data)
      // Seleção automática da primeira opção (mais barata) para conveniência
      if (data.opcoes.length > 0) {
        const primeira = data.opcoes[0]
        setSelecionado(primeira.tipo)
        onSelect({
          tipoEntrega: primeira.tipo,
          valorFrete: primeira.valor,
          prazoEntrega: primeira.prazo,
          cepEntrega: data.cep,
        })
      }
    } catch {
      toast.error('Erro ao calcular frete. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const selecionarOpcao = (opcao: OpcaoFrete) => {
    setSelecionado(opcao.tipo)
    onSelect({
      tipoEntrega: opcao.tipo,
      valorFrete: opcao.valor,
      prazoEntrega: opcao.prazo,
      cepEntrega: dados?.cep || cep,
    })
  }

  const conteudo = (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cep-frete" className="text-xs text-muted-foreground">
            CEP de entrega
          </Label>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="cep-frete"
              inputMode="numeric"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => setCep(aplicarMascaraCep(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && podeCalcular) {
                  e.preventDefault()
                  calcular()
                }
              }}
              className="pl-9 h-9"
              maxLength={9}
            />
          </div>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            onClick={calcular}
            disabled={!podeCalcular || loading}
            className="h-9 w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Calculando...
              </>
            ) : (
              <>
                <Calculator className="size-4" /> Calcular frete
              </>
            )}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      )}

      {!loading && dados && !dados.valido && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium">CEP inválido</p>
            <p>Digite um CEP brasileiro com 8 dígitos para ver as opções de entrega.</p>
          </div>
        </div>
      )}

      {!loading && dados && dados.valido && dados.opcoes.length === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-muted-foreground">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p className="text-xs">
            Nenhuma opção de entrega disponível para o CEP informado.
          </p>
        </div>
      )}

      {!loading && dados && dados.valido && dados.opcoes.length > 0 && (
        <>
          {dados.dentroSP ? (
            <p className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
              CEP dentro da área de cobertura (São Paulo capital) — entrega própria disponível!
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground bg-muted/50 border border-border rounded px-2 py-1">
              CEP fora da área de entrega própria — disponível apenas Sedex e retirada.
            </p>
          )}
          <RadioGroup
            value={selecionado || ''}
            onValueChange={(v) => {
              const op = dados.opcoes.find((o) => o.tipo === v)
              if (op) selecionarOpcao(op)
            }}
            className="gap-2"
          >
            {dados.opcoes.map((opcao) => {
              const Icon = ICONS[opcao.tipo]
              const checked = selecionado === opcao.tipo
              return (
                <Label
                  key={opcao.tipo}
                  htmlFor={`frete-${opcao.tipo}`}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    checked
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <RadioGroupItem
                    value={opcao.tipo}
                    id={`frete-${opcao.tipo}`}
                    className="mt-0.5"
                  />
                  <Icon
                    className={cn(
                      'size-5 shrink-0 mt-0.5',
                      checked ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium leading-tight">{opcao.label}</p>
                      <span
                        className={cn(
                          'text-sm font-bold',
                          opcao.valor === 0 ? 'text-green-600' : 'text-primary'
                        )}
                      >
                        {opcao.valor === 0 ? 'Grátis' : fmtMoeda(opcao.valor)}
                      </span>
                    </div>
                    {opcao.descricao && (
                      <p className="text-xs text-muted-foreground">{opcao.descricao}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Prazo: <strong className="text-foreground">{opcao.prazo}</strong>
                    </p>
                    {opcao.enderecoRetirada && (
                      <p className="text-[11px] text-muted-foreground bg-muted/40 rounded px-1.5 py-1 mt-1 flex items-start gap-1">
                        <MapPin className="size-3 shrink-0 mt-0.5" />
                        <span className="break-words">{opcao.enderecoRetirada}</span>
                      </p>
                    )}
                  </div>
                </Label>
              )
            })}
          </RadioGroup>
        </>
      )}

      {!loading && !dados && cepInicial && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Search className="size-3" /> CEP carregado do seu perfil. Ajuste se necessário.
        </p>
      )}
    </div>
  )

  if (compact) {
    return conteudo
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="size-4 text-primary" />
          Opções de entrega
        </CardTitle>
      </CardHeader>
      <CardContent>{conteudo}</CardContent>
    </Card>
  )
}

// Pequena badge auxiliar caso queira mostrar a opção selecionada fora do componente
export function FreteSelecionadoBadge({
  tipoEntrega,
  valorFrete,
  prazoEntrega,
}: {
  tipoEntrega: TipoEntrega | null
  valorFrete: number
  prazoEntrega: string | null
}) {
  if (!tipoEntrega) return null
  return (
    <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
      {tipoEntrega === 'retirada'
        ? 'Retirada na loja'
        : tipoEntrega === 'entrega_propria'
          ? 'Entrega própria'
          : 'Sedex'}
      <span className="text-primary">
        {valorFrete === 0 ? 'Grátis' : fmtMoeda(valorFrete)}
      </span>
      {prazoEntrega && (
        <span className="text-muted-foreground">· {prazoEntrega}</span>
      )}
    </Badge>
  )
}
