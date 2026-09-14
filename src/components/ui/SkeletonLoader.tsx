'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export type SkeletonLoaderType =
  | 'cards'
  | 'list'
  | 'kanban'
  | 'table'
  | 'dashboard'

interface SkeletonLoaderProps {
  type: SkeletonLoaderType
  count?: number
  className?: string
}

const defaultCount: Record<SkeletonLoaderType, number> = {
  cards: 6,
  list: 8,
  kanban: 4,
  table: 5,
  dashboard: 6,
}

/** Card skeleton reutilizável com 3-4 linhas de larguras variadas */
function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="size-8 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-7 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

/** Item de lista skeleton (1 linha horizontal com texto + actions) */
function SkeletonListItem() {
  return (
    <div className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Skeleton className="size-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  )
}

/** Coluna kanban skeleton */
function SkeletonKanbanColumn() {
  return (
    <div className="bg-muted/30 border border-border rounded-xl flex flex-col min-h-[300px]">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="size-2.5 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>
      <div className="p-3 space-y-2 flex-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-background border border-border rounded-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 flex-1 max-w-[120px]" />
            </div>
            <Skeleton className="h-3 w-2/3 mb-2" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Linha de tabela skeleton */
function SkeletonTableRow() {
  return (
    <tr className="border-b border-border">
      <td className="p-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </td>
      <td className="p-3"><Skeleton className="h-4 w-24" /></td>
      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
      <td className="p-3"><Skeleton className="h-6 w-16 rounded-full" /></td>
      <td className="p-3"><Skeleton className="h-4 w-16" /></td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </td>
    </tr>
  )
}

/** Skeleton do dashboard com KPIs + área de gráficos */
function SkeletonDashboard() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 sm:p-4 flex flex-col gap-2">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cards superiores (faturamento + status) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="space-y-2 text-right">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grid de gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-md" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function SkeletonLoader({ type, count, className }: SkeletonLoaderProps) {
  const n = count ?? defaultCount[type]

  switch (type) {
    case 'cards':
      return (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 ${className ?? ''}`}
        >
          {Array.from({ length: n }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )

    case 'list':
      return (
        <div className={`space-y-2 ${className ?? ''}`}>
          {Array.from({ length: n }).map((_, i) => (
            <SkeletonListItem key={i} />
          ))}
        </div>
      )

    case 'kanban':
      return (
        <div className={className}>
          {/* Desktop: 3 colunas */}
          <div className="hidden md:grid grid-cols-3 gap-4">
            <SkeletonKanbanColumn />
            <SkeletonKanbanColumn />
            <SkeletonKanbanColumn />
          </div>
          {/* Mobile: 1 coluna scroll */}
          <div className="md:hidden">
            <div className="flex gap-2 mb-3 overflow-x-auto">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <SkeletonKanbanColumn />
          </div>
        </div>
      )

    case 'table':
      return (
        <Card className={className}>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <th key={i} className="text-left p-3">
                      <Skeleton className="h-4 w-full" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: n }).map((_, i) => (
                  <SkeletonTableRow key={i} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )

    case 'dashboard':
      return <div className={className}>{SkeletonDashboard()}</div>

    default:
      return null
  }
}
