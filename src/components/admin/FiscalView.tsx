'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, Loader2, Package, ReceiptText, RefreshCw, Save, Search, Settings2, ShieldAlert, ExternalLink, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { camposEditaveisEmitente } from '@/lib/fiscal-emitente'
import { NfeXmlDraftForm } from '@/components/admin/NfeXmlDraftForm'
import { ConsultaAutomaticaTributaria } from '@/components/admin/ConsultaAutomaticaTributaria'
import { ImportarFiscalZetta } from '@/components/admin/ImportarFiscalZetta'

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
type ProntidaoFiscal = {
  ambienteSelecionado:string; modelo:string; emissaoRealHabilitada:boolean;
  aviso:string; concluido:number; total:number;
  requisitos:Array<{id:string;ok:boolean;titulo:string;detalhe:string}>
}
type FiscalData = { config: Config | null; vendas: Sale[]; notas: Nota[];
  emissaoConfigurada: boolean; emissaoMercadoLivreHabilitada: boolean;
  emissaoAviso: string; prontidaoNfeProducao: ProntidaoFiscal }
type Product = {
  id: string; nome: string; sku: string | null
  ncm: string | null; cest: string | null; cfop: string | null
  origem: string | null; cst: string | null; csosn: string | null; unidadeFiscal: string | null
  gtinFiscal: string | null; pisCst: string | null; cofinsCst: string | null
  ipiCst: string | null; ibsCbsCst: string | null; ibsCbsClassTrib: string | null
  pendencias: string[]
  anunciosVinculados?: number
  grupoSku?: string | null
  camposDivergentes?: string[]
  camposParciais?: string[]
  anunciosOriginais?: Array<{
    id:string;nome:string;sku:string|null;mlItemId?:string|null;amazonAsin?:string|null;zettaProCod?:number|null;
    ncm:string|null;cest:string|null;cfop:string|null;origem:string|null;cst:string|null;csosn:string|null;
    unidadeFiscal:string|null;gtinFiscal:string|null;pisCst:string|null;cofinsCst:string|null;
    ipiCst:string|null;ibsCbsCst:string|null;ibsCbsClassTrib:string|null;
  }>
}
type IndicadorFiscal = { preenchidos: number; faltando: number }
type IndicadoresFiscais = {
  total: number; anuncios?: number; anunciosAdicionais?: number; gruposComMultiplosAnuncios?: number; gruposConflitantes?: number; ncm: IndicadorFiscal; gtin: IndicadorFiscal; cfop: IndicadorFiscal;
  csosn: IndicadorFiscal; pisCofins: IndicadorFiscal; completosBasicos: number; pendentes: number
}
type FiltroFiscal = 'todos' | 'sem_ncm' | 'sem_gtin' | 'sem_cfop' | 'sem_csosn' | 'sem_pis_cofins' | 'pendentes'
type ProductsData = { produtos: Product[]; total: number; pagina: number; porPagina: number; filtro: FiltroFiscal; indicadores: IndicadoresFiscais }
const FILTROS_FISCAIS: {value: FiltroFiscal; label: string; contagem: keyof IndicadoresFiscais | null}[] = [
  {value:'todos',label:'Todos',contagem:'total'},
  {value:'pendentes',label:'Pendências de tributação',contagem:'pendentes'},
  {value:'sem_ncm',label:'Sem NCM',contagem:'ncm'},
  {value:'sem_gtin',label:'Sem GTIN',contagem:'gtin'},
  {value:'sem_cfop',label:'Sem CFOP',contagem:'cfop'},
  {value:'sem_csosn',label:'Sem CSOSN',contagem:'csosn'},
  {value:'sem_pis_cofins',label:'Sem PIS/COFINS',contagem:'pisCofins'},
]
type Aba = 'notas' | 'emitente' | 'produtos'
type FiscalPreflight = {
  canal:string;modeloSugerido:string;tipo:string;provedor:string;
  prontoParaSolicitar:boolean;habilitadoParaEmissao:boolean;
  checks:Array<{id:string;ok:boolean;texto:string}>;aviso:string;
}
type AmazonFiscalStatus = { apiConfigurada: boolean; aviso: string; emissaoNfeDisponivel: boolean }
type EmissorStatus = {
  provedor:string
  certificadoConfigurado:boolean
  emitenteSp:boolean
  municipioConfigurado:boolean
  emissaoRealHabilitada:boolean
  aviso:string
  enderecoServico:string
}
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
  const [emitenteSalvo, setEmitenteSalvo] = useState(false)
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
  const [diagnosticoSefaz,setDiagnosticoSefaz] = useState<{mensagem:string;codigo:string;categoria:string}|null>(null)
  const [conciliandoId,setConciliandoId] = useState<string|null>(null)
  const [chaveFiscal,setChaveFiscal] = useState('')
  const [confirmadoFiscal,setConfirmadoFiscal] = useState(false)
  const [salvandoChave,setSalvandoChave] = useState(false)
  const [copiandoResumo,setCopiandoResumo] = useState<string|null>(null)
  const [gerandoPrevia,setGerandoPrevia] = useState<string|null>(null)
  const [montandoNfe,setMontandoNfe] = useState<string|null>(null)
  const [buscaVenda, setBuscaVenda] = useState('')
  const [produtos, setProdutos] = useState<ProductsData | null>(null)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [filtroProduto, setFiltroProduto] = useState<FiltroFiscal>('todos')
  const [pagina, setPagina] = useState(1)
  const [editandoProduto, setEditandoProduto] = useState<Product | null>(null)
  const [grupoEditando, setGrupoEditando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const result = await jsonRes(await fetch('/api/admin/fiscal', { cache: 'no-store' })) as FiscalData
      setData(result)
      setConfig(camposEditaveisEmitente({ ...EMPTY, ...(result.config || {}) }) as Config)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar fiscal.')
    } finally { setLoading(false) }
  }, [])

  const carregarProdutos = useCallback(async (page: number, busca: string, filtro: FiltroFiscal) => {
    try {
      const query = new URLSearchParams({ pagina: String(page), busca, filtro })
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
  useEffect(() => { if (aba === 'produtos') void carregarProdutos(pagina, buscaProduto, filtroProduto) }, [aba, pagina, carregarProdutos, buscaProduto, filtroProduto])

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
        body: JSON.stringify(camposEditaveisEmitente(config)), credentials: 'same-origin',
      }))
      setEmitenteSalvo(true)
      toast.success('Dados do emitente salvos! A emissão real ainda depende do serviço fiscal.')
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
    setDiagnosticoSefaz(null)
    try{
      const response=await fetch('/api/admin/fiscal/provedor',{method:'POST',credentials:'same-origin'})
      const result=await response.json()
      const codigo=typeof result.codigoTecnico==='string'&&/^[A-Z0-9_]{2,75}$/.test(result.codigoTecnico)?result.codigoTecnico:'NAO_INFORMADO'
      const categoria=typeof result.categoria==='string'&&/^[a-z-]{2,50}$/.test(result.categoria)?result.categoria:'consulta'
      setDiagnosticoSefaz({mensagem:result.error||result.aviso||result.motivo||'Consulta concluída.',codigo,categoria})
      if(!response.ok) throw new Error(result.error||'Falha na consulta SEFAZ.')
      if (result.ok) toast.success(result.aviso||'Serviço SEFAZ em operação, sem emissão.')
      else toast.error(result.aviso||result.motivo||'SEFAZ não confirmou disponibilidade do serviço.')
    }catch(e){toast.error(e instanceof Error?e.message:'Erro no teste da conexão fiscal.')}
    finally{setTestandoProvedor(false)}
  }

  async function baixarPreviaXml(vendaId:string){
    setGerandoPrevia(vendaId)
    try{
      const response=await fetch('/api/admin/fiscal/previa-xml',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({vendaId}),
      })
      if(!response.ok){
        const body=await response.json().catch(()=>({}))
        throw new Error(body.error||'Não foi possível gerar a prévia XML.')
      }
      if(!response.headers.get('content-type')?.includes('application/xml')) throw new Error('Resposta inválida ao gerar prévia. Atualize a página e tente novamente.')
      const url=URL.createObjectURL(await response.blob())
      const link=document.createElement('a')
      link.href=url
      link.download='PREVIA-SEM-VALIDADE-FISCAL-'+vendaId.replace(/[^a-zA-Z0-9_-]/g,'')+'.xml'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(()=>URL.revokeObjectURL(url),1000)
      toast.success('Prévia XML gerada para conferência. Consulte as pendências no arquivo; não tem validade fiscal.')
    }catch(e){toast.error(e instanceof Error?e.message:'Falha ao gerar prévia XML.')}
    finally{setGerandoPrevia(null)}
  }

  async function copiarResumoFiscal(vendaId:string){
    setCopiandoResumo(vendaId)
    try{
      const result=await jsonRes(await fetch('/api/admin/fiscal/mercado-pago?vendaId='+encodeURIComponent(vendaId),{
        credentials:'same-origin',cache:'no-store',
      }))
      await navigator.clipboard.writeText(result.resumo)
      toast.success('Resumo fiscal do pedido copiado. Revise antes de emitir no Mercado Pago.')
    }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível copiar o resumo.')}
    finally{setCopiandoResumo(null)}
  }
  async function registrarNotaMercadoPago(vendaId:string){
    if(!confirmadoFiscal){toast.error('Confirme que a NF-e já foi emitida pelo Mercado Pago.');return}
    setSalvandoChave(true)
    try{
      const result=await jsonRes(await fetch('/api/admin/fiscal/mercado-pago',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({vendaId,chaveAcesso:chaveFiscal,confirmacao:'JA_EMITIDA_FORA_DO_ERP'}),
      }))
      toast.success(result.aviso||'Chave registrada para conciliação.')
      setConciliandoId(null);setChaveFiscal('');setConfirmadoFiscal(false)
      await carregar()
    }catch(e){toast.error(e instanceof Error?e.message:'Erro ao conciliar NF-e.')}
    finally{setSalvandoChave(false)}
  }
  async function salvarProduto() {
    if (!editandoProduto) return
    setSaving(true)
    try {
      await jsonRes(await fetch('/api/admin/fiscal/produtos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:editandoProduto.id,ncm:editandoProduto.ncm,cest:editandoProduto.cest,cfop:editandoProduto.cfop,
          origem:editandoProduto.origem,cst:editandoProduto.cst,csosn:editandoProduto.csosn,
          unidadeFiscal:editandoProduto.unidadeFiscal,gtinFiscal:editandoProduto.gtinFiscal,
          pisCst:editandoProduto.pisCst,cofinsCst:editandoProduto.cofinsCst,
          ipiCst:editandoProduto.ipiCst,ibsCbsCst:editandoProduto.ibsCbsCst,
          ibsCbsClassTrib:editandoProduto.ibsCbsClassTrib,
        }), credentials: 'same-origin',
      }))
      toast.success('Classificação fiscal salva no anúncio selecionado. Dados de outros anúncios não são sobrescritos.')
      setEditandoProduto(null)
      setGrupoEditando(null)
      await carregarProdutos(pagina, buscaProduto, filtroProduto)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao salvar produto.') }
    finally { setSaving(false) }
  }

  const alterar = (key: keyof Config, value: string) => {
    setEmitenteSalvo(false)
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
            <p className="mt-1 text-sm">Estamos construindo o emissor próprio de NF-e 55 diretamente com a SEFAZ-SP, inicialmente em homologação. A consulta de status do serviço não é uma emissão nem um credenciamento do CNPJ. Os pedidos do site e Amazon serão atendidos por este emissor quando concluirmos XML, assinatura, homologação e conferência fiscal. O Mercado Livre mantém seu Faturador para evitar notas duplicadas. Serviços e NFC-e exigem módulos específicos.</p>
          </div>
        </div>
      </div>
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold">SEFAZ-SP · Emissor próprio de NF-e modelo 55</p>
          <p className="text-xs text-muted-foreground">
            Certificado A1: {emissorStatus?.certificadoConfigurado?'configurado na Vercel (ainda não validado)':'pendente de configurar no servidor'}.
            {' '}Emitente SP: {emissorStatus?.emitenteSp?'sim':'verificar'}. Município IBGE: {emissorStatus?.municipioConfigurado?'salvo':'pendente'}.
          </p>
          <p className="text-xs text-muted-foreground">
            O teste acessa apenas NFeStatusServico4 em <strong>homologação</strong>; não transmite nota fiscal nem ativa produção.
            {' '}As credenciais do A1 devem ser adicionadas somente às variáveis protegidas de servidor.
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={testandoProvedor||!emissorStatus?.emitenteSp}
          onClick={()=>void testarProvedor()}>
          {testandoProvedor?<Loader2 className="mr-2 size-4 animate-spin"/>:<ShieldAlert className="mr-2 size-4"/>}
          Testar SEFAZ-SP (homologação)
        </Button>
      </CardContent></Card>
      {diagnosticoSefaz&&<div role="status" className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
        <p className="font-semibold">Resultado do teste SEFAZ-SP · homologação</p>
        <p>{diagnosticoSefaz.mensagem}</p>
        <p className="break-words text-xs">Categoria: {diagnosticoSefaz.categoria} · Código técnico: <strong>{diagnosticoSefaz.codigo}</strong></p>
        <p className="text-xs text-muted-foreground">Envie este resultado ao suporte. O teste não emite nota fiscal.</p>
      </div>}
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Emissor Mercado Pago · fluxo manual sem outro provedor</p>
          <p className="mt-1 text-xs text-muted-foreground">O A1 já está configurado no Mercado Pago. Use o Sistema de Gestão para emitir notas de vendas ali registradas. Ainda não há API pública de emissão fiscal externa confirmada para pedidos do site/Amazon. O ERP copia os dados do pedido e registra a chave fiscal para conciliação, sem gerar cobrança duplicada.</p>
          <p className="mt-1 text-xs text-muted-foreground">Confirme as condições comerciais do Sistema de Gestão na conta: ausência de cobrança por nota não garante isenção da mensalidade.</p>
        </div>
        <Button size="sm" type="button" variant="outline"
          onClick={()=>window.open('https://www.mercadopago.com.br/','_blank','noopener,noreferrer')}>
          <ExternalLink className="mr-2 size-4"/>Abrir Mercado Pago
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
          <div className="rounded-lg border p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Como emitir as NF-e das vendas do site</p>
            <p className="mt-1">1. Salve os dados do emitente em Dados do emitente. 2. Revise NCM, origem e tributação em Tributação dos produtos. 3. Verifique CPF/CNPJ, endereço e itens do pedido com Validar para emitir. 4. Configure o certificado A1 protegido na Vercel e teste a SEFAZ-SP em homologação. 5. O ERP só poderá transmitir NF-e quando implementarmos o XML oficial completo, assinatura digital, consulta e aprovação da contabilidade.</p>
            <p className="mt-1">Gerar XML de prévia baixa um documento interno de pendências. Montar NF-e 55 abre o novo formulário para gerar um rascunho com a estrutura nacional XML 4.00 apenas em homologação, restrito a algumas operações do Simples Nacional e sem validação XSD 010f ou reforma tributária completa. Nenhum dos dois arquivos é uma NF-e assinada ou autorizada. Evite duplicidades com notas já emitidas nos marketplaces ou Mercado Pago.</p>
          </div>
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
                    {v.status==='concluida'&&['site','amazon','mercadolivre','mercado_livre'].includes(v.canal)&&(
                      <Button size="sm" variant="outline" disabled={gerandoPrevia!==null}
                        onClick={()=>void baixarPreviaXml(v.id)}
                        title="Baixar XML de conferência interna com pendências; sem assinatura ou validade fiscal">
                        {gerandoPrevia===v.id?<Loader2 className="mr-1 size-4 animate-spin"/>:<Download className="mr-1 size-4"/>}
                        Gerar XML de prévia
                      </Button>
                    )}
                    {v.status==='concluida'&&['site','amazon'].includes(v.canal)&&!v.notaFiscal?.chaveAcesso&&(
                      <Button size="sm" variant="outline" onClick={()=>setMontandoNfe(montandoNfe===v.id?null:v.id)}
                        aria-expanded={montandoNfe===v.id} title="Somente rascunho NF-e 55 em homologação. Não transmite à SEFAZ.">
                        <FileText className="mr-1 size-4"/>Montar NF-e 55 (homologação)
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={copiandoResumo===v.id}
                      onClick={()=>void copiarResumoFiscal(v.id)}>
                      {copiandoResumo===v.id?<Loader2 className="mr-1 size-4 animate-spin"/>:<ClipboardList className="mr-1 size-4"/>}
                      Copiar dados
                    </Button>
                    {!v.notaFiscal?.chaveAcesso&&v.status==='concluida'&&(
                      <Button size="sm" variant="outline" onClick={()=>{
                        setConciliandoId(conciliandoId===v.id?null:v.id)
                        setChaveFiscal('');setConfirmadoFiscal(false)
                      }}>Registrar NF-e emitida</Button>
                    )}
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
                  {montandoNfe===v.id&&<NfeXmlDraftForm vendaId={v.id} onClose={()=>setMontandoNfe(null)}/>}
                  {conciliandoId===v.id&&(
                    <div className="w-full space-y-3 rounded-xl border p-3">
                      <p className="text-sm font-semibold">Registrar NF-e já emitida no Mercado Pago</p>
                      <p className="text-xs text-muted-foreground">Use somente após conferir a autorização no emissor. Uma chave com dígito correto não prova autorização na SEFAZ. O registro ficará pendente de verificação e não transmite outra nota.</p>
                      <Label htmlFor={'chave-fiscal-'+v.id}>Chave de acesso (44 dígitos)</Label>
                      <Input id={'chave-fiscal-'+v.id} value={chaveFiscal} maxLength={55}
                        placeholder="Chave da nota fiscal já emitida" onChange={e=>setChaveFiscal(e.target.value)}/>
                      <label className="flex items-start gap-2 text-xs">
                        <input type="checkbox" checked={confirmadoFiscal} onChange={e=>setConfirmadoFiscal(e.target.checked)} className="mt-0.5"/>
                        Confirmei a emissão no Mercado Pago e conferi que não existe outra nota para esta venda.
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={salvandoChave||!confirmadoFiscal||chaveFiscal.replace(/\s/g,'').length!==44}
                          onClick={()=>void registrarNotaMercadoPago(v.id)}>
                          {salvandoChave?<Loader2 className="mr-1 size-4 animate-spin"/>:<Save className="mr-1 size-4"/>}
                          Registrar para conciliação
                        </Button>
                        <Button size="sm" variant="outline" onClick={()=>setConciliandoId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  )}
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
          {data?.prontidaoNfeProducao && <div className="rounded-lg border p-4 space-y-3" role="status">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">Verificação para NF-e real em produção</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.prontidaoNfeProducao.concluido} de {data.prontidaoNfeProducao.total} verificações concluídas ou pré-configuradas
                </p>
              </div>
              <Badge variant="outline" className="text-amber-700 dark:text-amber-300">Emissão própria bloqueada</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{data.prontidaoNfeProducao.aviso}</p>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Ver requisitos e pendências</summary>
              <div className="mt-3 space-y-3">
                {data.prontidaoNfeProducao.requisitos.map(r=><div key={r.id} className="flex items-start gap-2">
                  {r.ok?<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600"/>:<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600"/>}
                  <div><p className="font-medium">{r.titulo}</p><p className="text-xs text-muted-foreground">{r.detalhe}</p></div>
                </div>)}
              </div>
            </details>
            <p className="text-xs text-muted-foreground">
              A opção Produção abaixo registra uma preferência cadastral. O teste de conexão A1/SEFAZ
              permanece no ambiente de homologação e não transmite NF-e.
            </p>
          </div>}
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
          {emitenteSalvo && <p role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
            Cadastro fiscal salvo com sucesso. Isso confirma apenas o registro no ERP, não o credenciamento junto à SEFAZ.
          </p>}
          <p className="text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mr-1 inline size-3" />Salvar estes dados não ativa a emissão em produção. A escolha do ambiente é apenas uma preferência cadastrada.</p>
          <Button onClick={salvarEmitente} disabled={saving}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Salvar dados fiscais</Button>
        </CardContent></Card>
      )}

      {aba === 'produtos' && (
        <Card><CardContent className="space-y-4 p-4 sm:p-6">
          <div><h2 className="font-semibold">Classificação fiscal do catálogo · Simples Nacional (CRT 1)</h2><p className="text-xs text-muted-foreground">Códigos por produto devem ser validados pelo contador. ICMS-ST, FCP, IPI, PIS, COFINS e IBS/CBS não recebem alíquotas automáticas; a incidência depende da operação e destino.</p></div>
          <ImportarFiscalZetta onImported={()=>{setPagina(1);setBuscaProduto('');setFiltroProduto('todos');setEditandoProduto(null);setGrupoEditando(null);void carregarProdutos(1,'','todos')}}/>

          {produtos?.indicadores && <div className="space-y-3 rounded-xl border bg-muted/20 p-4" aria-label="Progresso do preenchimento fiscal do catálogo">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm font-semibold">Preenchimento fiscal do catálogo</p>
                <p className="text-xs text-muted-foreground">{produtos.indicadores.total} anúncios cadastrados · dados reais do banco</p>
              </div>
              <Badge variant="outline" className="text-amber-700 dark:text-amber-300">NF-e própria não liberada</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {([
                {rotulo:'NCM',dados:produtos.indicadores.ncm},
                {rotulo:'GTIN/EAN',dados:produtos.indicadores.gtin},
                {rotulo:'CFOP de referência',dados:produtos.indicadores.cfop},
                {rotulo:'CSOSN (ICMS do Simples)',dados:produtos.indicadores.csosn},
                {rotulo:'CST PIS + COFINS',dados:produtos.indicadores.pisCofins},
              ]).map(item=><div key={item.rotulo} className="rounded-lg border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{item.rotulo}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{item.dados.preenchidos}/{produtos.indicadores.total}</span>
                </div>
                <div className="my-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-green-600" style={{width:(produtos.indicadores.total?item.dados.preenchidos/produtos.indicadores.total*100:0)+'%'}}/>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">{item.dados.faltando} faltando</p>
              </div>)}
            </div>
            <p className="text-xs font-medium">{produtos.indicadores.completosBasicos} produto(s) com os seis campos básicos registrados · {produtos.indicadores.pendentes} ainda com pendências</p>
            <p className="text-xs text-muted-foreground">Indicadores de preenchimento, não de validação de imposto nem de autorização de NF-e. CEST, ICMS-ST, FCP, IPI e IBS/CBS só se aplicam conforme mercadoria, operação e vigência. Origem e unidade preenchidas também devem ser verificadas.</p>
          </div>}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar pendências fiscais">
            {FILTROS_FISCAIS.map(item=><Button key={item.value} type="button" size="sm"
              variant={filtroProduto===item.value?'default':'outline'}
              aria-pressed={filtroProduto===item.value}
              onClick={()=>{setFiltroProduto(item.value);setPagina(1);setEditandoProduto(null)}}>
              {item.label}
              {produtos?.indicadores && <span className="ml-1 opacity-80 tabular-nums">({
                item.value==='todos'?produtos.indicadores.total:
                item.value==='pendentes'?produtos.indicadores.pendentes:
                item.value==='sem_ncm'?produtos.indicadores.ncm.faltando:
                item.value==='sem_gtin'?produtos.indicadores.gtin.faltando:
                item.value==='sem_cfop'?produtos.indicadores.cfop.faltando:
                item.value==='sem_csosn'?produtos.indicadores.csosn.faltando:
                produtos.indicadores.pisCofins.faltando
              })</span>}
            </Button>)}
          </div>
          <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={buscaProduto} onChange={(e) => { setBuscaProduto(e.target.value); setPagina(1); setEditandoProduto(null) }} className="pl-9" placeholder="Buscar produto ou SKU..." /></div>
          {!produtos ? <p className="py-6 text-center text-sm text-muted-foreground">Carregando produtos...</p> : (
            <>
              <p className="text-xs text-muted-foreground">{produtos.total} SKU(s)/fichas encontrado(s) no filtro selecionado · {produtos.indicadores?.anuncios ?? 0} anúncios originais preservados · {produtos.indicadores?.anunciosAdicionais ?? 0} anúncios agrupados</p>
              <div className="divide-y rounded-xl border">
                {produtos.produtos.map((p) => (
                  <div key={p.id} className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-sm font-medium">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">SKU: {p.sku || 'Não informado'} · {p.pendencias.length} pendência(s) identificada(s) · Revenda CRT 1 {p.anunciosVinculados && p.anunciosVinculados>1?' · '+p.anunciosVinculados+' anúncios vinculados':''}</p>
                        {p.camposDivergentes && p.camposDivergentes.length>0 &&
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Conflito entre anúncios: {p.camposDivergentes.join(', ')}. Confira antes de salvar.</p>}
                        {p.camposParciais && p.camposParciais.length>0 &&
                          <p className="text-xs text-amber-700 dark:text-amber-300">Preenchimento parcial nos anúncios: {p.camposParciais.join(', ')}. A ficha reúne dados existentes, mas alguns anúncios continuam incompletos.</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            {k:'NCM',ok:!!p.ncm,desc:p.ncm||'pendente'},
                            {k:'GTIN',ok:!!p.gtinFiscal,desc:p.gtinFiscal||'pendente'},
                            {k:'CFOP',ok:!!p.cfop,desc:p.cfop||'por operação'},
                            {k:'ICMS/CSOSN',ok:!!p.csosn,desc:p.csosn||'pendente'},
                            {k:'PIS',ok:!!p.pisCst,desc:p.pisCst||'pendente'},
                            {k:'COFINS',ok:!!p.cofinsCst,desc:p.cofinsCst||'pendente'},
                          ]).map(item=><span key={item.k} className={'rounded border px-2 py-0.5 text-xs '+(item.ok?'border-green-700/25 text-green-700 dark:text-green-300':'border-amber-600/30 bg-amber-500/5 text-amber-700 dark:text-amber-300')}>
                            {item.k}: {item.desc}
                          </span>)}
                        </div>
                      </div>
                      <Button variant="outline" size="sm"
                        aria-expanded={grupoEditando === p.id}
                        aria-controls={'classificacao-' + p.id}
                        onClick={() => {
                          if(grupoEditando===p.id){setGrupoEditando(null);setEditandoProduto(null)}
                          else{setGrupoEditando(p.id);setEditandoProduto({...p})}
                        }}>
                        {grupoEditando === p.id ? 'Fechar classificação' : 'Classificar SKU'}
                      </Button>
                    </div>
                    {grupoEditando === p.id && editandoProduto && (
                      <div id={'classificacao-' + p.id} className="mt-3 space-y-4 rounded-xl border border-primary/30 bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div><p className="font-semibold">{editandoProduto.nome}</p><p className="text-xs text-muted-foreground">Preencha somente os códigos validados pelo contador. CFOP depende da operação.</p></div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => {setEditandoProduto(null);setGrupoEditando(null)}}>Fechar</Button>
                        </div>
                        
                        {p.anunciosOriginais && p.anunciosOriginais.length>1 && (
                          <div className="rounded-lg border bg-background p-3 space-y-2">
                            <p className="text-sm font-semibold">{p.anunciosOriginais.length} anúncios vinculados ao mesmo SKU</p>
                            <p className="text-xs text-muted-foreground">Mercado Livre, Amazon e Zetta podem usar títulos diferentes. Nenhum anúncio foi excluído. Para corrigir dados divergentes, escolha o anúncio correspondente.</p>
                            <div className="flex max-h-52 flex-col gap-1 overflow-y-auto">
                              {p.anunciosOriginais.map(a=><button key={a.id} type="button"
                                className={'rounded border p-2 text-left text-xs hover:bg-muted '+(editandoProduto.id===a.id?'border-primary bg-primary/5':'')}
                                onClick={()=>setEditandoProduto({...a,pendencias:p.pendencias})}>
                                <span className="font-medium">{a.nome}</span>
                                <span className="block text-muted-foreground">{a.mlItemId?'Mercado Livre':a.amazonAsin?'Amazon':a.zettaProCod!=null?'Zetta':'Loja'} · NCM {a.ncm||'pendente'} · CSOSN {a.csosn||'pendente'} · CFOP {a.cfop||'pendente'}</span>
                              </button>)}
                            </div>
                            <Button type="button" size="sm" variant="outline" onClick={()=>setEditandoProduto({...p})}>
                              Ver cadastro unificado (somente referência)
                            </Button>
                          </div>
                        )}
                        <div className="rounded-lg border bg-background p-3 space-y-3">
                          <p className="text-xs font-semibold">Identificação da mercadoria · documento do fornecedor</p>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {(['ncm','gtinFiscal','origem','unidadeFiscal','cest'] as const).map(key=><div key={key} className="space-y-1.5">
                              <Label htmlFor={'tax-'+p.id+'-'+key}>
                                {{ncm:'NCM',gtinFiscal:'GTIN/EAN',origem:'Origem',unidadeFiscal:'Unidade',cest:'CEST (se aplicável)'}[key]}
                              </Label>
                              <Input id={'tax-'+p.id+'-'+key} value={editandoProduto[key]||''} onChange={e=>alterarProduto(key,e.target.value)} className={!editandoProduto[key]&&key!=='cest'?'border-amber-600/50':''}/>
                            </div>)}
                          </div>
                        </div>
                        <div className="rounded-lg border bg-background p-3 space-y-3">
                          <p className="text-xs font-semibold">Tributação da venda · Simples Nacional (CRT 1)</p>
                          <p className="text-xs text-muted-foreground">A tributação depende da operação e do destinatário. Um imposto ausente não equivale a alíquota zero. Use as regras validadas pela contabilidade.</p>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {(['cfop','csosn','pisCst','cofinsCst','ipiCst','ibsCbsCst','ibsCbsClassTrib'] as const).map(key=><div key={key} className="space-y-1.5">
                              <Label htmlFor={'tax-'+p.id+'-'+key}>
                                {{cfop:'CFOP de referência',csosn:'ICMS / CSOSN',pisCst:'CST PIS',cofinsCst:'CST COFINS',ipiCst:'CST IPI (se aplicável)',ibsCbsCst:'IBS/CBS CST (se aplicável)',ibsCbsClassTrib:'IBS/CBS cClassTrib (se aplicável)'}[key]}
                              </Label>
                              <Input id={'tax-'+p.id+'-'+key} value={editandoProduto[key]||''} onChange={e=>alterarProduto(key,e.target.value)} className={!editandoProduto[key]&&['cfop','csosn','pisCst','cofinsCst'].includes(key)?'border-amber-600/50':''}/>
                            </div>)}
                          </div>
                          <p className="text-xs text-muted-foreground">ICMS-ST, FCP e alíquotas exigem cálculo e regra específica da operação. CST de ICMS do regime normal não é utilizado como CSOSN no CRT 1.</p>
                        </div>
                        <ConsultaAutomaticaTributaria
                          key={editandoProduto.id}
                          produto={editandoProduto}
                          aoAplicar={campos=>{
                            setEditandoProduto(p=>p?{...p,...campos}:null)
                            toast.success('Códigos sugeridos aplicados no formulário. Confira e clique em Salvar classificação.')
                          }}
                        />
                        {editandoProduto.pendencias.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">Pendências anteriores: {editandoProduto.pendencias.join(' · ')}. Salve para atualizar a análise.</p>}
                        <p className="text-xs text-muted-foreground">A classificação por produto não substitui cálculo fiscal por operação e não autoriza emissão de NF-e.</p>
                        {p.camposDivergentes && p.camposDivergentes.length>0 && editandoProduto.id===p.id &&
                          <p className="text-xs text-amber-700 dark:text-amber-300">Existem dados conflitantes no SKU. Selecione um anúncio original acima para editar sem apagar os valores dos demais.</p>}
                        <Button type="button" disabled={saving || Boolean(p.camposDivergentes?.length && editandoProduto.id===p.id)} onClick={salvarProduto}>
                          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Salvar classificação
                        </Button>
                      </div>
                    )}
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

        </CardContent></Card>
      )}
    </div>
  )
}
