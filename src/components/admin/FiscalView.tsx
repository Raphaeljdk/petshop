'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, Loader2, Package, ReceiptText, RefreshCw, Save, Search, Settings2, ShieldAlert, ExternalLink, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type Config = {
  razaoSocial: string | null
  nomeFantasia: string | null
  cnpj: string | null
  inscricaoEstadual: string | null
  regimeTributario: string | null
  logradouro: string | null
  numeroEndereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  codigoMunicipio: string | null
  serieNfe: number
  ambiente: 'homologacao' | 'producao'
}
const EMPTY: Config = {
  razaoSocial: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '',
  regimeTributario: null, logradouro: '', numeroEndereco: '', bairro: '',
  cidade: '', uf: '', cep: '', codigoMunicipio: '', serieNfe: 1, ambiente: 'homologacao',
}
type Sale = {
  id: string; total: number; canal: string; status: string
  marketplaceOrderId: string | null; marketplaceBuyerName: string | null
  mercadoPagoStatus: string | null; createdAt: string
  cliente: { nome: string; cpfCnpj: string | null } | null
  notaFiscal: { id: string; status: string; numero: number | null; chaveAcesso: string | null; emissor: string | null } | null
}
type Nota = {
  id: string; vendaId: string; modelo: string; status: string
  numero: number | null; chaveAcesso: string | null
  protocolo: string | null; danfeUrl: string | null; createdAt: string
}
type FiscalData = { config: Config | null; vendas: Sale[]; notas: Nota[]; emissaoConfigurada: boolean; emissaoMercadoLivreHabilitada: boolean; emissaoAviso: string }
type Product = {
  id: string; nome: string; sku: string | null
  ncm: string | null; cest: string | null; cfop: string | null
  origem: string | null; cst: string | null; csosn: string | null; unidadeFiscal: string | null
}
type ProductsData = { produtos: Product[]; total: number; pagina: number; porPagina: number }
type Aba = 'notas' | 'emitente' | 'produtos'
type FiscalPreflight = {
  canal:string;modeloSugerido:string;tipo:string;provedor:string;
  prontoParaSolicitar:boolean;habilitadoParaEmissao:boolean;
  checks:Array<{id:string;ok:boolean;texto:string}>;aviso:string;
}
type AmazonFiscalStatus = { apiConfigurada: boolean; aviso: string; emissaoNfeDisponivel: boolean }
type EmissorStatus = { provedor: string; credenciais: { producao: boolean; homologacao: boolean }; aviso: string }
type NotaAmazonFba = {
  id:string;numeroExterno:string|null;serie:string|null;
  status:string;data:string|null;pedido:string|null;tipo:string|null;
}
const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataCurta = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

async function jsonRes(response: Response) {
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || 'A operação não pôde ser concluída.')
  return value
}

export function FiscalView() {
  const [aba, setAba] = useState<Aba>('notas')
  const [data, setData] = useState<FiscalData | null>(null)
  const [config, setConfig] = useState<Config>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preparando, setPreparando] = useState<string | null>(null)
  const [consultando, setConsultando] = useState<string | null>(null)
  const [emitindo, setEmitindo] = useState<string | null>(null)
  const [testando,setTestando] = useState<string|null>(null)
  const [inspecionando,setInspecionando] = useState<string|null>(null)
  const [preflights,setPreflights] = useState<Record<string,FiscalPreflight>>({})
  const [notasFba,setNotasFba] = useState<NotaAmazonFba[]|null>(null)
  const [amazonStatus,setAmazonStatus] = useState<AmazonFiscalStatus|null>(null)
  const [emissorStatus,setEmissorStatus] = useState<EmissorStatus|null>(null)
  const [consultandoFba,setConsultandoFba] = useState(false)
  const [testandoProvedor,setTestandoProvedor] = useState(false)
  const [buscaVenda, setBuscaVenda] = useState('')
  const [produtos, setProdutos] = useState<ProductsData | null>(null)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [pagina, setPagina] = useState(1)
  const [editandoProduto, setEditandoProduto] = useState<Product | null>(null)

  const carregar = useCallback(async () => {
    try {
      const result = await jsonRes(await fetch('/api/admin/fiscal', { cache: 'no-store' })) as FiscalData
      setData(result)
      setConfig({ ...EMPTY, ...(result.config || {}) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar fiscal.')
    } finally { setLoading(false) }
  }, [])

  const carregarProdutos = useCallback(async (page: number, busca: string) => {
    try {
      const query = new URLSearchParams({ pagina: String(page), busca })
      setProdutos(await jsonRes(await fetch('/api/admin/fiscal/produtos?' + query.toString(), { cache: 'no-store' })))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar produtos.')
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(()=>{
    let mounted=true
    Promise.all([
      fetch('/api/admin/fiscal/amazon/status',{cache:'no-store',credentials:'same-origin'}).then(jsonRes),
      fetch('/api/admin/fiscal/provedor',{cache:'no-store',credentials:'same-origin'}).then(jsonRes),
    ]).then(([a,p])=>{if(mounted){setAmazonStatus(a);setEmissorStatus(p)}})
      .catch(()=>{if(mounted)toast.error('Não foi possível verificar as integrações fiscais.')})
    return ()=>{mounted=false}
  },[])
  useEffect(() => { if (aba === 'produtos') void carregarProdutos(pagina, buscaProduto) }, [aba, pagina, carregarProdutos, buscaProduto])

  const vendas = useMemo(() => {
    const term = buscaVenda.trim().toLocaleLowerCase('pt-BR')
    return (data?.vendas || []).filter((v) =>
      !term || [v.id, v.canal, v.cliente?.nome, v.marketplaceBuyerName, v.marketplaceOrderId].some((s) => (s || '').toLowerCase().includes(term))
    )
  }, [data, buscaVenda])

  async function salvarEmitente() {
    setSaving(true)
    try {
      await jsonRes(await fetch('/api/admin/fiscal', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config), credentials: 'same-origin',
      }))
      toast.success('Dados do emitente salvos no ERP próprio.')
      await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao salvar emitente.') }
    finally { setSaving(false) }
  }

  async function preparar(vendaId: string) {
    setPreparando(vendaId)
    try {
      const result = await jsonRes(await fetch('/api/admin/fiscal/notas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendaId }), credentials: 'same-origin',
      }))
      toast.success(result.aviso || 'Rascunho preparado.')
      await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao preparar nota.') }
    finally { setPreparando(null) }
  }

  async function operacaoMeli(venda: Sale, acao: 'consultar' | 'emitir') {
    if (acao === 'emitir') {
      if (!data?.emissaoMercadoLivreHabilitada) {
        toast.error('Emissão real não habilitada na integração. Confira as permissões fiscais antes de ativar.')
        return
      }
      if (!window.confirm('ATENÇÃO: isso solicitará uma NF-e REAL no Mercado Livre para o pedido ' +
        (venda.marketplaceOrderId || venda.id) +
        '. Confirme apenas se a venda ainda não tem nota e os dados fiscais foram validados. Deseja emitir?')) return
    }
    if (acao === 'consultar') setConsultando(venda.id)
    else setEmitindo(venda.id)
    try {
      const result = await jsonRes(await fetch('/api/admin/fiscal/mercado-livre', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendaId: venda.id, acao,
          ...(acao === 'emitir' ? { confirmacao: 'EMITIR_NFE_REAL' } : {}),
        }),
      }))
      toast.success(result.aviso || (acao === 'consultar' ? 'Consulta concluída.' : 'Solicitação enviada.'))
      await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha na operação fiscal.') }
    finally { setConsultando(null); setEmitindo(null) }
  }

  function baixarMeli(vendaId: string, tipo: 'xml' | 'danfe') {
    const url = '/api/admin/fiscal/mercado-livre/documento?' +
      new URLSearchParams({ vendaId, tipo }).toString()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function testarEmissao(vendaId:string){
    setTestando(vendaId);setInspecionando(vendaId)
    try{
      const result=await jsonRes(await fetch('/api/admin/fiscal/validar',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({vendaId})
      })) as FiscalPreflight
      setPreflights(prev=>({...prev,[vendaId]:result}))
      toast.success('Teste fiscal concluído sem emitir nota.')
    }catch(e){toast.error(e instanceof Error?e.message:'Falha na validação fiscal.')}
    finally{setTestando(null)}
  }
  async function carregarFba(){
    setConsultandoFba(true)
    try{
      const result=await jsonRes(await fetch('/api/admin/fiscal/amazon/notas',{cache:'no-store',credentials:'same-origin'}))
      setNotasFba(result.notas||[])
      toast.success('Notas Amazon FBA consultadas (somente leitura).')
    }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível consultar a Amazon.')}
    finally{setConsultandoFba(false)}
  }
  async function testarProvedor(){
    setTestandoProvedor(true)
    try{
      const result=await jsonRes(await fetch('/api/admin/fiscal/provedor',{method:'POST',credentials:'same-origin'}))
      toast.success(result.aviso||'Conexão fiscal validada sem emissão.')
    }catch(e){toast.error(e instanceof Error?e.message:'Erro no teste da conexão fiscal.')}
    finally{setTestandoProvedor(false)}
  }

  async function salvarProduto() {
    if (!editandoProduto) return
    setSaving(true)
    try {
      await jsonRes(await fetch('/api/admin/fiscal/produtos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editandoProduto), credentials: 'same-origin',
      }))
      toast.success('Classificação fiscal salva.')
      setEditandoProduto(null)
      await carregarProdutos(pagina, buscaProduto)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao salvar produto.') }
    finally { setSaving(false) }
  }

  const alterar = (key: keyof Config, value: string) => {
    setConfig((v) => ({ ...v, [key]: key === 'serieNfe' ? Number(value) : value }))
  }
  const campo = (key: keyof Config, titulo: string, placeholder = '') => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={'fiscal-' + key}>{titulo}</Label>
      <Input id={'fiscal-' + key} placeholder={placeholder} value={String(config[key] ?? '')} onChange={(e) => alterar(key, e.target.value)} />
    </div>
  )
  const alterarProduto = (key: keyof Product, value: string) => setEditandoProduto((p) => p ? { ...p, [key]: value } : null)

  const semNota = data?.vendas.filter((v) => !v.notaFiscal && v.status !== 'cancelada').length || 0
  const rascunhos = data?.notas.filter((n) => n.status === 'rascunho').length || 0

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ReceiptText className="size-6 text-primary" /> Fiscal e Notas</h1>
          <p className="mt-1 text-sm text-muted-foreground">ERP Matilha Prado · NF-e modelo 55 para site, Mercado Livre e Amazon</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); void carregar() }} disabled={loading}>
          <RefreshCw className="mr-2 size-4" /> Atualizar
        </Button>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-5 shrink-0"/>
          <div><p className="font-semibold">Central fiscal da Matilha Prado · todos os canais</p>
            <p className="mt-1 text-sm">O botão Validar para emitir apresenta pendências sem transmitir nada à SEFAZ. O Mercado Livre possui integração de consulta e emissão condicionada a permissões. Site, Amazon e Hub precisam de emissor fiscal universal com API, certificado A1 e homologação. Varejo presencial pode exigir NFC-e e serviços exigem NFS-e. Nenhum rascunho equivale a uma nota válida.</p>
          </div>
        </div>
      </div>
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><p className="text-sm font-semibold">Emissor universal · Focus NFe (alternativa atual)</p>
          <p className="text-xs text-muted-foreground">A Nuvem Fiscal foi desativada. {emissorStatus?.credenciais.producao?'Token Focus NFe configurado para consulta.':'Token Focus NFe ainda não configurado na Vercel.'} O cadastro do certificado e a homologação da emissão ainda serão necessários.</p>
        </div>
        <Button variant="outline" size="sm" disabled={testandoProvedor} onClick={()=>void testarProvedor()}>
          {testandoProvedor?<Loader2 className="mr-2 size-4 animate-spin"/>:<ShieldAlert className="mr-2 size-4"/>}
          Testar Focus NFe
        </Button>
      </CardContent></Card>
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><p className="text-sm font-semibold">Amazon SP-API · {amazonStatus?.apiConfigurada?'Conexão configurada':'Configuração pendente'}</p>
          <p className="text-xs text-muted-foreground">{amazonStatus?.aviso||'Verificando as credenciais Amazon...'}</p>
        </div>
        <Button size="sm" variant="outline" disabled={consultandoFba||!amazonStatus?.apiConfigurada}
          onClick={()=>{setAba('notas');void carregarFba()}}>
          {consultandoFba?<Loader2 className="mr-2 size-4 animate-spin"/>:<Search className="mr-2 size-4"/>}Testar notas Amazon FBA
        </Button>
      </CardContent></Card>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Vendas sem registro fiscal', value: semNota, icon: ClipboardList },
          { label: 'Rascunhos de NF-e', value: rascunhos, icon: FileText },
          { label: 'NF-e autorizadas neste ERP', value: data?.notas.filter((n) => n.status === 'autorizada').length || 0, icon: CheckCircle2 },
        ].map((stat) => (
          <Card key={stat.label}><CardContent className="p-4">
            <stat.icon className="size-5 text-muted-foreground" />
            <p className="mt-3 text-2xl font-bold">{loading ? '...' : stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        <Button size="sm" variant={aba === 'notas' ? 'default' : 'outline'} onClick={() => setAba('notas')}><FileText className="mr-1.5 size-4" /> Pedidos e notas</Button>
        <Button size="sm" variant={aba === 'emitente' ? 'default' : 'outline'} onClick={() => setAba('emitente')}><Settings2 className="mr-1.5 size-4" /> Dados do emitente</Button>
        <Button size="sm" variant={aba === 'produtos' ? 'default' : 'outline'} onClick={() => setAba('produtos')}><Package className="mr-1.5 size-4" /> Tributação dos produtos</Button>
      </div>

      {aba === 'notas' && (
        <Card><CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-semibold">Pedidos e emissão centralizada</h2><p className="text-xs text-muted-foreground">Use o teste seguro para identificar pendências antes de emitir em qualquer canal.</p></div>
            <Badge variant="outline">NF-e 55</Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
            <div><p className="text-sm font-semibold">Notas existentes Amazon FBA</p>
              <p className="text-xs text-muted-foreground">Consulta somente leitura de notas FBA. Não cobre todos os pedidos Amazon.</p></div>
            <Button size="sm" variant="outline" disabled={consultandoFba} onClick={()=>void carregarFba()}>
              {consultandoFba?<Loader2 className="mr-2 size-4 animate-spin"/>:<Search className="mr-2 size-4"/>}
              Consultar notas FBA
            </Button>
          </div>
          {notasFba&&<div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-3">
            {notasFba.length===0?<p className="text-xs text-muted-foreground">Nenhuma nota FBA retornada.</p>:
              notasFba.map(n=><div key={n.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1.5 text-xs">
                <span>Pedido: {n.pedido||'—'} · NF-e: {n.numeroExterno||n.id} · Série: {n.serie||'—'}</span>
                <Badge variant="outline">{n.status}</Badge>
              </div>)}
          </div>}
          <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={buscaVenda} onChange={(e) => setBuscaVenda(e.target.value)} placeholder="Buscar cliente, venda ou pedido do marketplace..." /></div>
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p> : vendas.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</p> : (
            <div className="divide-y rounded-xl border">
              {vendas.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-sm">{v.cliente?.nome || v.marketplaceBuyerName || 'Consumidor não identificado'}</p>
                      <Badge variant="secondary" className="text-[10px]">{v.canal.replaceAll('_', ' ')}</Badge>
                      {v.notaFiscal && <Badge variant="outline" className="text-[10px]">NF-e: {v.notaFiscal.status}{v.notaFiscal.numero ? ' · nº ' + v.notaFiscal.numero : ''}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{dataCurta(v.createdAt)} · Pedido {v.marketplaceOrderId || v.id.slice(-8)} · {v.status}</p>
                  </div>
                  <p className="font-semibold text-sm">{moeda(v.total)}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" onClick={()=>void testarEmissao(v.id)} disabled={testando===v.id || emitindo===v.id}
                      title="Primeiro valida sem transmitir à SEFAZ">
                      {testando===v.id?<Loader2 className="mr-1 size-4 animate-spin"/>:<FileText className="mr-1 size-4"/>}
                      Validar para emitir
                    </Button>
                    {(v.canal==='mercadolivre'||v.canal==='mercado_livre')&&(<>
                      <Button size="sm" variant="outline" disabled={consultando===v.id} onClick={()=>void operacaoMeli(v,'consultar')}>
                        {consultando===v.id?<Loader2 className="mr-1 size-4 animate-spin"/>:<Search className="mr-1 size-4"/>}Consultar NF-e
                      </Button>
                      {v.notaFiscal?.status==='autorizada'&&v.notaFiscal.chaveAcesso&&(<>
                        <Button size="sm" variant="outline" onClick={()=>baixarMeli(v.id,'xml')}><Download className="mr-1 size-4"/>XML</Button>
                        <Button size="sm" variant="outline" onClick={()=>baixarMeli(v.id,'danfe')}><Download className="mr-1 size-4"/>DANFE</Button>
                      </>)}
                    </>)}
                  </div>
                  {inspecionando===v.id&&preflights[v.id]&&(
                    <div className="w-full rounded-xl border bg-muted/30 p-3 text-sm">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">Resultado do teste · {preflights[v.id].tipo} (modelo {preflights[v.id].modeloSugerido})</p>
                        <Badge variant={preflights[v.id].habilitadoParaEmissao?'default':'outline'}>
                          {preflights[v.id].habilitadoParaEmissao?'Apto a solicitar emissão':'Pendências a resolver'}
                        </Badge>
                      </div>
                      <div className="space-y-1">{preflights[v.id].checks.map(c=>
                        <p key={c.id} className={c.ok?'text-green-700 dark:text-green-400':'text-amber-800 dark:text-amber-300'}>
                          {c.ok?'✓':'•'} {c.texto}
                        </p>)}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{preflights[v.id].aviso}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {preflights[v.id].provedor==='mercado_livre'&&preflights[v.id].habilitadoParaEmissao&&(
                          <Button size="sm" disabled={emitindo===v.id} onClick={()=>void operacaoMeli(v,'emitir')}>
                            Confirmar emissão real no Mercado Livre
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={()=>setInspecionando(null)}>Fechar</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground"><a href="https://developers.mercadolivre.com.br/pt_br/convivencia-me1-me2/obtendo-nota-fiscal" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline"><ExternalLink className="size-3"/>Documentação oficial das notas Mercado Livre</a></div>
          {!!data?.notas.length && <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Histórico: {data.notas.length} registro(s). Se a nota já foi emitida pelo Mercado Pago, concilie-a antes de qualquer transmissão pelo ERP. XML e DANFE oficiais somente após autorização fiscal.</div>}
        </CardContent></Card>
      )}

      {aba === 'emitente' && (
        <Card><CardContent className="space-y-5 p-4 sm:p-6">
          <div><h2 className="font-semibold">Cadastro do emitente</h2><p className="text-xs text-muted-foreground">Informe os dados da Matilha Prado conforme o cadastro na SEFAZ e confirme o regime com o contador. Nenhum certificado ou token é solicitado aqui.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campo('razaoSocial', 'Razão social')}
            {campo('nomeFantasia', 'Nome fantasia')}
            {campo('cnpj', 'CNPJ', '00.000.000/0000-00')}
            {campo('inscricaoEstadual', 'Inscrição estadual')}
            <div className="space-y-1.5"><Label htmlFor="regime-fiscal">Regime tributário (CRT)</Label>
              <select id="regime-fiscal" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={config.regimeTributario || ''} onChange={(e) => alterar('regimeTributario', e.target.value)}>
                <option value="">Selecionar com contador</option><option value="1">1 — Simples Nacional</option><option value="2">2 — Simples Nacional (excesso de sublimite)</option><option value="3">3 — Regime normal</option>
              </select>
            </div>
            {campo('logradouro', 'Logradouro')}
            {campo('numeroEndereco', 'Número')}
            {campo('bairro', 'Bairro')}
            {campo('cidade', 'Cidade')}
            {campo('uf', 'UF', 'SP')}
            {campo('cep', 'CEP', '00000-000')}
            {campo('codigoMunicipio', 'Código IBGE do município')}
            {!config.codigoMunicipio&&config.cidade?.trim().toLowerCase()==='são paulo'&&config.uf?.trim().toUpperCase()==='SP'&&(
              <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                <span>Código IBGE sugerido para São Paulo/SP: <strong>3550308</strong>. Confira os dados do emitente.</span>
                <Button type="button" size="sm" variant="outline" onClick={()=>alterar('codigoMunicipio','3550308')}>Preencher município</Button>
              </div>
            )}
            {campo('serieNfe', 'Série de NF-e', '1')}
            <div className="space-y-1.5"><Label htmlFor="ambiente-fiscal">Ambiente</Label>
              <select id="ambiente-fiscal" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={config.ambiente} onChange={(e) => alterar('ambiente', e.target.value)}>
                <option value="homologacao">Homologação (testes)</option><option value="producao">Produção (aguarda liberação)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mr-1 inline size-3" />Salvar estes dados não ativa a emissão em produção. A escolha do ambiente é apenas uma preferência cadastrada.</p>
          <Button onClick={salvarEmitente} disabled={saving}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Salvar dados fiscais</Button>
        </CardContent></Card>
      )}

      {aba === 'produtos' && (
        <Card><CardContent className="space-y-4 p-4 sm:p-6">
          <div><h2 className="font-semibold">Classificação fiscal do catálogo</h2><p className="text-xs text-muted-foreground">NCM, CEST, CFOP, origem e CST/CSOSN precisam ser revisados com a contabilidade. O CFOP pode variar conforme o destino e a operação.</p></div>
          <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={buscaProduto} onChange={(e) => { setBuscaProduto(e.target.value); setPagina(1) }} className="pl-9" placeholder="Buscar produto ou SKU..." /></div>
          {!produtos ? <p className="py-6 text-center text-sm text-muted-foreground">Carregando produtos...</p> : (
            <>
              <p className="text-xs text-muted-foreground">{produtos.total} produto(s) encontrado(s)</p>
              <div className="divide-y rounded-xl border">
                {produtos.produtos.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.nome}</p><p className="text-xs text-muted-foreground">SKU: {p.sku || 'Não informado'} · NCM: {p.ncm || 'Pendente'}</p></div>
                    <Button variant="outline" size="sm" onClick={() => setEditandoProduto({ ...p })}>Classificar</Button>
                  </div>
                ))}
                {produtos.produtos.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina((n) => n - 1)}>Anterior</Button>
                <span className="self-center text-xs text-muted-foreground">Página {pagina} de {Math.max(1, Math.ceil(produtos.total / 30))}</span>
                <Button variant="outline" size="sm" disabled={pagina * 30 >= produtos.total} onClick={() => setPagina((n) => n + 1)}>Próxima</Button>
              </div>
            </>
          )}
          {editandoProduto && (
            <div className="space-y-4 rounded-xl border border-primary/30 bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{editandoProduto.nome}</p><p className="text-xs text-muted-foreground">Preencha somente códigos aprovados pelo contador.</p></div><Button variant="ghost" size="sm" onClick={() => setEditandoProduto(null)}>Fechar</Button></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(['ncm', 'cest', 'cfop', 'origem', 'cst', 'csosn', 'unidadeFiscal'] as const).map((key) => (
                  <div key={key} className="space-y-1.5"><Label htmlFor={'tax-' + key}>{key === 'unidadeFiscal' ? 'Unidade' : key.toUpperCase()}</Label><Input id={'tax-' + key} value={editandoProduto[key] || ''} onChange={(e) => alterarProduto(key, e.target.value)} /></div>
                ))}
              </div>
              <Button disabled={saving} onClick={salvarProduto}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Salvar classificação</Button>
            </div>
          )}
        </CardContent></Card>
      )}
    </div>
  )
}
