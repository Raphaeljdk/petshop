'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

type Publicacao = {
  id: string
  title: string
  category: string
  summary: string
  body: string
  imageUrl: string | null
  createdAt: string
  isPetStory: boolean
}
const data = (valor: string) => new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export function LandingBlog() {
  const [artigos, setArtigos] = useState<Publicacao[]>([])
  const [selecionado, setSelecionado] = useState<Publicacao | null>(null)
  useEffect(() => {
    let ativo = true
    fetch('/api/public/blog', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Blog indisponível')
        return res.json() as Promise<{ artigos: Publicacao[] }>
      })
      .then((payload) => { if (ativo) setArtigos(payload.artigos ?? []) })
      .catch(() => { /* O blog não deve impedir o carregamento da página pública. */ })
    return () => { ativo = false }
  }, [])

  // Não exibir artigos de exemplo, fotos privadas ou cartões vazios.
  if (!artigos.length) return null

  return (
    <section id="blog" className="bg-background py-12 sm:py-16" aria-labelledby="blog-landing-title">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <PawPrint className="size-4" /> Blog da Matilha Prado
            </p>
            <h2 id="blog-landing-title" className="text-2xl font-bold sm:text-3xl">Histórias, fotos e dicas para sua matilha</h2>
            <p className="mt-2 text-sm text-muted-foreground">Publicações selecionadas e histórias compartilhadas com autorização dos tutores.</p>
          </div>
          <span className="text-xs text-muted-foreground">Novidades da nossa família pet</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artigos.slice(0, 3).map((artigo) => (
            <article key={artigo.id} className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
              {artigo.imageUrl ? (
                <img src={artigo.imageUrl} alt={`Imagem da publicação ${artigo.title}`}
                  loading="lazy" className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-primary/10">
                  <BookOpen className="size-12 text-primary/50" aria-hidden="true" />
                </div>
              )}
              <div className="space-y-2 p-4 sm:p-5">
                <p className="text-xs font-semibold text-primary">{artigo.category} · {data(artigo.createdAt)}</p>
                <h3 className="line-clamp-2 text-lg font-bold">{artigo.title}</h3>
                <p className="line-clamp-3 text-sm text-muted-foreground">{artigo.summary}</p>
                <Button size="sm" variant="outline" onClick={() => setSelecionado(artigo)}>
                  Ler publicação <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
        {artigos.length > 3 && (
          <div className="mt-5 flex justify-center">
            <Button variant="outline" onClick={() => document.getElementById('blog-publicacoes')?.scrollIntoView({ behavior: 'smooth' })}>
              Ver mais publicações <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        )}
        {artigos.length > 3 && (
          <div id="blog-publicacoes" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {artigos.slice(3).map((artigo) => (
              <button type="button" key={artigo.id} onClick={() => setSelecionado(artigo)}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40">
                {artigo.imageUrl ? <img src={artigo.imageUrl} alt="" loading="lazy" className="size-16 shrink-0 rounded-lg object-cover" />
                  : <BookOpen className="size-8 shrink-0 text-primary/50" aria-hidden="true" />}
                <span className="min-w-0">
                  <span className="block text-xs text-primary">{artigo.category}</span>
                  <span className="line-clamp-2 text-sm font-semibold">{artigo.title}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Dialog open={!!selecionado} onOpenChange={(open) => { if (!open) setSelecionado(null) }}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          {selecionado && (
            <article className="space-y-4">
              {selecionado.imageUrl && <img src={selecionado.imageUrl} alt="" className="max-h-72 w-full rounded-xl object-cover" />}
              <p className="text-xs font-semibold text-primary">{selecionado.category} · {data(selecionado.createdAt)}</p>
              <DialogTitle className="text-xl font-bold sm:text-2xl">{selecionado.title}</DialogTitle>
              <DialogDescription>{selecionado.summary}</DialogDescription>
              <div className="space-y-3 text-sm leading-7">
                {selecionado.body.split(/\n{2,}/).filter(Boolean).map((p, i) => (
                  <p key={i} className="whitespace-pre-wrap">{p}</p>
                ))}
              </div>
            </article>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
