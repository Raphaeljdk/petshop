'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Heart, Search, ArrowLeft, ShoppingBag, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { portalRequest } from './ExperienceProvider'

type Article = {
  id:string; title:string; category:string; summary:string; body:string
  imageUrl:string|null; productId:string|null; createdAt:string; isPetStory?:boolean
}
type BlogData = { articles:Article[]; favorites:string[] }
type Props = { publicView?:boolean; onProduct?:(id:string)=>void; onBook?:()=>void; compact?:boolean; onOpenBlog?:()=>void; onShop?:()=>void }

export function ClientBlog({ compact=false, onOpenBlog, onShop, publicView=false, onProduct, onBook }: Props) {
  const [articles,setArticles] = useState<Article[]>([])
  const [favorites,setFavorites] = useState<string[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [query,setQuery] = useState('')
  const [category,setCategory] = useState('Todas')
  const [selected,setSelected] = useState<Article|null>(null)
  const [busy,setBusy] = useState(false)
  const [retry,setRetry] = useState(0)
  useEffect(() => {
    let live = true
    portalRequest<BlogData>(publicView ? '/api/public/blog' : '/api/cliente/portal').then((res) => {
      if (!live) return
      setArticles(res.articles || [])
      setFavorites(res.favorites || [])
      setError('')
    }).catch((e) => { if (live) setError((e as Error).message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  },[retry,publicView])
  const categories = useMemo(() => ['Todas', ...new Set(articles.map((x) => x.category))],[articles])
  const filtered = useMemo(() => articles.filter((p) =>
    (category === 'Todas' || p.category === category) &&
    [p.title,p.summary,p.body].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
  ),[articles,query,category])

  async function toggle(id:string) {
    if (busy || id.startsWith('historia-pet:')) return
    setBusy(true)
    try {
      const saved = !favorites.includes(id)
      await portalRequest('/api/cliente/portal', {
        method:'POST',body:JSON.stringify({ action:'favorite',articleId:id,saved }),
      })
      setFavorites((before) => saved ? [...before,id] : before.filter((v) => v !== id))
      toast.success(saved ? 'Artigo salvo nos favoritos.' : 'Artigo removido dos favoritos.')
    } catch(e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }
  if (compact) return <section className="space-y-3" aria-label="Dicas da Matilha Prado">
    <div className="flex items-center justify-between">
      <div><h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen className="size-5 text-primary"/>Dicas da Matilha Prado</h2>
        <p className="text-xs text-muted-foreground">Conteúdos para cuidar de quem você ama.</p></div>
      <Button size="sm" variant="outline" onClick={onOpenBlog}>Ver blog</Button>
    </div>
    {loading ? <div className="grid gap-3 sm:grid-cols-2">{[0,1].map((n)=><div key={n} className="h-28 animate-pulse rounded-xl bg-muted"/>)}</div> :
      articles.length ? <div className="grid gap-3 sm:grid-cols-2">
        {articles.slice(0,2).map((article) => <button type="button" key={article.id}
          onClick={onOpenBlog} className="rounded-xl border bg-card p-4 text-left transition-shadow hover:shadow-md">
          <p className="text-xs font-semibold text-primary">{article.category}</p>
          <h3 className="mt-1 font-semibold">{article.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.summary}</p>
        </button>)}
      </div> : <p className="text-sm text-muted-foreground">Novos conteúdos estão sendo preparados.</p>}
  </section>

  return <section className="space-y-5">
    {selected ? <>
      <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><ArrowLeft className="mr-2 size-4"/>Voltar ao blog</Button>
      <article className="overflow-hidden rounded-2xl border bg-card">
        {selected.imageUrl && <img src={selected.imageUrl} alt="" className="h-44 w-full object-cover sm:h-64" loading="lazy"/>}
        <div className="space-y-4 p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase text-primary">{selected.category} · {new Date(selected.createdAt).toLocaleDateString('pt-BR')}</p>
          <h2 className="text-2xl font-bold sm:text-3xl">{selected.title}</h2>
          <p className="text-sm font-medium text-muted-foreground">{selected.summary}</p>
          <div className="space-y-4 text-sm leading-7">{selected.body.split(/\n{2,}/).filter(Boolean).map((p,i) =>
            <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {!publicView&&!selected.isPetStory&&<Button size="sm" variant="outline" disabled={busy} onClick={() => toggle(selected.id)}>
              <Heart className={'mr-2 size-4 '+(favorites.includes(selected.id)?'fill-red-500 text-red-500':'')}/>
              {favorites.includes(selected.id)?'Salvo':'Salvar artigo'}
            </Button>}
            {selected.productId && <Button size="sm" variant="outline" onClick={()=>onProduct && selected.productId ? onProduct(selected.productId) : onShop?.()}><ShoppingBag className="mr-2 size-4"/>Ver produtos na loja</Button>}
            <Button size="sm" variant="outline" onClick={() => {
              if (navigator.share) void navigator.share({ title:selected.title, text:selected.summary }).catch(()=>{})
              else { void navigator.clipboard?.writeText(selected.title+' — '+selected.summary).then(()=>toast.success('Resumo copiado.')).catch(()=>toast.error('Não foi possível copiar.')) }
            }}>Compartilhar</Button>
          </div>
        </div>
      </article>
    </> : <>
      <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Blog para tutores</p>
        <h2 className="text-2xl font-bold">Dicas da Matilha</h2>
        <p className="text-sm text-muted-foreground">Cuidados, brincadeiras e novidades selecionados pela Matilha Prado.</p></div>
      <label className="relative block">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground"/>
        <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar artigos do blog" placeholder="Buscar artigos..."/>
      </label>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => <Button key={c} size="sm" variant={category===c?'default':'outline'} onClick={() => setCategory(c)}>{c}</Button>)}
      </div>
      {publicView && <details className="mp-faq"><summary>O primeiro banho do pet</summary><p>Na primeira visita, conte à equipe sobre a rotina do seu pet e como ele reage à água e ao secador. No check-in, vocês podem combinar os cuidados e registrar as preferências do atendimento.</p><button type="button" className="mp-text-link" onClick={onBook}>Consultar o primeiro banho</button></details>}
      {loading && <p role="status" className="text-sm text-muted-foreground">Carregando artigos...</p>}
      {error && <Card><CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
        <p>{error}</p><Button variant="outline" size="sm" onClick={() => {setLoading(true);setRetry(x=>x+1)}}><RefreshCw className="mr-1 size-4"/>Tentar novamente</Button>
      </CardContent></Card>}
      {!loading && !error && filtered.length===0 && <p className="rounded-xl border p-5 text-sm text-muted-foreground">Nenhum artigo disponível para estes filtros.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p)=><Card key={p.id} className="overflow-hidden">
          {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="h-40 w-full object-cover"/> :
            <div className="flex h-28 items-center justify-center bg-primary/5"><BookOpen className="size-10 text-primary/40"/></div>}
          <CardContent className="space-y-3 p-4">
            <p className="text-xs font-semibold text-primary">{p.category}</p>
            <h2 className="line-clamp-2 font-bold">{p.title}</h2>
            <p className="line-clamp-3 text-sm text-muted-foreground">{p.summary}</p>
            <div className="flex justify-between gap-2">
              <Button size="sm" onClick={()=>setSelected(p)}>Ler artigo</Button>
              {!publicView&&!p.isPetStory&&<Button size="icon" variant="outline" disabled={busy} aria-label="Salvar artigo" onClick={()=>toggle(p.id)}>
                <Heart className={'size-4 '+(favorites.includes(p.id)?'fill-red-500 text-red-500':'')}/>
              </Button>}
            </div>
          </CardContent>
        </Card>)}
      </div>
    </>}
  </section>
}
