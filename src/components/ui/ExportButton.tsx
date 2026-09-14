'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export type ExportType =
  | 'vendas'
  | 'agendamentos'
  | 'clientes'
  | 'produtos'
  | 'entregas'

interface ExportButtonProps {
  type: ExportType
  label?: string
  variant?: 'default' | 'outline' | 'ghost'
  className?: string
}

const LABELS_DEFAULT: Record<ExportType, string> = {
  vendas: 'Exportar Vendas',
  agendamentos: 'Exportar Agendamentos',
  clientes: 'Exportar Clientes',
  produtos: 'Exportar Produtos',
  entregas: 'Exportar Entregas',
}

/**
 * Botão reutilizável que dispara o download de um CSV via /api/export?type=...
 * Mostra toast de sucesso/erro e aceita variant do shadcn/ui Button.
 */
export function ExportButton({
  type,
  label,
  variant = 'outline',
  className,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/export?type=${type}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Erro ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${LABELS_DEFAULT[type]} exportado com sucesso!`)
    } catch (e: any) {
      console.error('export erro:', e)
      toast.error(e.message || 'Erro ao exportar CSV')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={handleExport}
      disabled={loading}
      className={className}
    >
      <Download className="size-4" />
      <span className="ml-1">{loading ? 'Exportando...' : (label || LABELS_DEFAULT[type])}</span>
    </Button>
  )
}
