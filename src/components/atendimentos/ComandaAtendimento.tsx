'use client'
import { useCallback,useEffect,useRef,useState } from 'react'
import { ShoppingBag,RefreshCw,CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/components/cliente-portal/ExperienceProvider'
import { PagamentoCheckout } from '@/components/cliente-portal/PagamentoCheckout'
import { toast } from 'sonner'

type Sale={id:string;total:number;status:string;mercadoPagoStatus?:string|null;mercadoPagoPaymentUrl?:string|null;statusEntrega?:string|null;itens?:Array<{quantidade:number;precoUnit:number;produto:{nome:string}}>}
type Extra={id:string;nome:string;precoCentavos:number;duracaoMinutos:number;motivo:string|null;status:string;venda:Sale|null;liberado?:boolean;pago?:boolean;pendenteFinanceiro?:boolean}
type Product={id:string;nome:string;preco:number;precoPromo?:number|null;estoque:number}
type Data={fechadaEm?:string|null;pendencias?:string[];principalVenda?:Sale|null;principalPago?:boolean;bookingRequestId?:string|null;solicitacoes?:Array<{id:string;service:string;confirmedAt:string|null;gravataPrecoCentavos:number;gravataFoto:string|null}>;processo:{id:string;servico:string;status:string;valorServico:number;petNome:string};aberto:boolean;permiteSolicitar?:boolean;extras:Extra[];vendas:Sale[];servicos:Array<{chave:string;nome:string;precoCentavos:number;duracaoMinutos:number}>}
const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const statusLabel:Record<string,string>={aguardando_tutor:'Aguardando tutor',aguardando_equipe:'Aguardando equipe',autorizado:'Autorizado',recusado:'Recusado',realizado:'Realizado',concluida:'Pagamento registrado',pendente:'Aguardando pagamento',cancelada:'Cancelada'}
const label=(s:string)=>statusLabel[s]||s
export function ComandaAtendimento({processoId,equipe=false}:{processoId:string;equipe?:boolean}){
 const [grupo,setGrupo]=useState<string[]>([])
 const [data,setData]=useState<Data|null>(null)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [servico,setServico]=useState('')
 const [booking,setBooking]=useState('')
 const [motivo,setMotivo]=useState('')
 const [produtos,setProdutos]=useState<Product[]>([])
 const [busca,setBusca]=useState('')
 const [produto,setProduto]=useState('')
 const [quantidade,setQuantidade]=useState(1)
 const [pagamento,setPagamento]=useState<Sale|null>(null)
 const compraKey=useRef<string|null>(null)
 const url='/api/comandas/'+encodeURIComponent(processoId)
 const load=useCallback(async()=>{try{setData(await portalRequest<Data>(url));setError('')}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar a comanda.')}},[url])
 useEffect(()=>{setData(null);setPagamento(null);setServico('');setProduto('');compraKey.current=null;void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},15000);return()=>clearInterval(timer)},[load])
 useEffect(()=>{if(!data?.aberto)return;let live=true;portalRequest<Product[]>('/api/cliente/produtos').then(p=>{if(live)setProdutos(p.filter(x=>x.estoque>0))}).catch(()=>{});return()=>{live=false}},[equipe,data?.aberto])
 async function agir(body:Record<string,unknown>){
  if(busy)return
  setBusy(true)
  try{const r=await portalRequest<{venda?:Sale}>(url,{method:'POST',body:JSON.stringify(body)});if(!equipe&&r.venda&&r.venda.status==='pendente')setPagamento(r.venda);setGrupo([]);setServico('');setMotivo('');await load();toast.success('Comanda atualizada.')}
  catch(e){toast.error(e instanceof Error?e.message:'Operação não concluída.')}
  finally{setBusy(false)}
 }
 async function comprar(){
  if(busy||!produto||!Number.isInteger(quantidade)||quantidade<1)return
  setBusy(true)
  try{
   const key=compraKey.current??crypto.randomUUID();compraKey.current=key
   const venda=await portalRequest<Sale>('/api/cliente/carrinho',{method:'POST',body:JSON.stringify({itens:[{produtoId:produto,quantidade}],tipoEntrega:'retirada',comandaProcessoId:processoId,comandaCompraKey:key})})
   compraKey.current=null;setProduto('');setQuantidade(1);if(venda.status==='pendente'&&!equipe)setPagamento(venda);await load()
   toast.success(equipe?'Produto incluído. O tutor pode pagar no portal.':'Compra registrada na comanda. Confirme o pagamento.')
  }catch(e){toast.error(e instanceof Error?e.message:'Compra não concluída.');await load()}
  finally{setBusy(false)}
 }
 const selecionado=produtos.find(p=>p.id===produto)
 if(!data)return <div className="rounded-lg border p-3 text-sm">{error||'Carregando comanda...'}{error&&<Button size="sm" variant="outline" onClick={()=>void load()}>Tentar novamente</Button>}</div>
 return <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Comanda do atendimento">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-base font-bold">Comanda de {data.processo.petNome}</h3><p className="text-xs text-muted-foreground">Atendimento {processoId.slice(-8).toUpperCase()}</p></div><Badge variant={data.aberto?'default':'secondary'}>{data.aberto?'Em atendimento':data.permiteSolicitar?'Em avaliação inicial':'Encerrado'}</Badge><Button size="sm" variant="outline" onClick={()=>void load()}><RefreshCw className="mr-1 size-4"/>Atualizar</Button></div>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  <div className="flex justify-between rounded-lg bg-muted/50 p-3 text-sm"><div><b>{data.processo.servico}</b><p className="text-xs text-muted-foreground">{data.principalPago?'Serviço original · pagamento confirmado':'Serviço original · pagamento não conciliado na comanda'}</p></div><b>{brl(data.processo.valorServico)}</b></div>
  {equipe&&data.permiteSolicitar&&!data.bookingRequestId&&!!data.solicitacoes?.length&&<div className="rounded-lg border p-3 space-y-2"><p className="text-sm font-medium">Vincular agendamento confirmado</p><select aria-label="Agendamento confirmado" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={booking} onChange={e=>setBooking(e.target.value)}><option value="">Selecione o agendamento correspondente</option>{data.solicitacoes.map(b=><option key={b.id} value={b.id}>{b.service} · {b.confirmedAt?new Date(b.confirmedAt).toLocaleString('pt-BR'):'Data não informada'}{b.gravataPrecoCentavos?' · Gravata + R$ 5,00':''}</option>)}</select>{data.solicitacoes.find(b=>b.id===booking)?.gravataFoto&&<img src={data.solicitacoes.find(b=>b.id===booking)!.gravataFoto!} alt="Foto para a gravata" className="size-24 object-contain rounded border"/>}<Button size="sm" disabled={busy||!booking} onClick={()=>{if(window.confirm('Vincular este agendamento ao atendimento? O adicional de gravata, se houver, será importado uma única vez.'))void agir({action:'vincular-agendamento',bookingId:booking})}}>Vincular</Button></div>}
  <div className="rounded-lg border p-3 text-sm space-y-1">
   <p className="font-semibold">Financeiro dos adicionais</p>
   <p>Recebido: {brl(data.extras.filter(x=>x.pago).reduce((n,x)=>n+x.precoCentavos/100,0))}</p>
   <p>Saldo autorizado: {brl(data.extras.filter(x=>x.pendenteFinanceiro).reduce((n,x)=>n+x.precoCentavos/100,0))}</p>
   {data.extras.some(x=>x.status==='aguardando_tutor'||x.status==='aguardando_equipe')&&<p className="text-xs text-muted-foreground">Há serviços aguardando autorização. Ainda não incluídos no saldo.</p>}
   {equipe&&<Button type="button" size="sm" variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+'/#agendamentos');toast.success('Link do portal copiado. O tutor deve entrar na própria conta para pagar.')}catch{toast.error('Não foi possível copiar o link.')}}}>Copiar link do portal para pagamento</Button>}
  </div>
  <div className="rounded-lg border p-3 space-y-2 text-sm">
   <p className="font-semibold">Fechamento financeiro</p>
   {data.fechadaEm?<p className="text-green-700">Comanda encerrada em {new Date(data.fechadaEm).toLocaleString('pt-BR')}.</p>:<>
   {data.pendencias?.map(p=><p key={p} className="text-xs text-amber-700">{p}</p>)}
   {!data.principalPago&&data.principalVenda?.status==='pendente'&&!equipe&&<Button size="sm" onClick={()=>setPagamento(data.principalVenda!)}>Pagar serviço principal</Button>}
   {!data.principalPago&&!data.principalVenda&&!data.bookingRequestId&&equipe&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{if(window.confirm('Confirme que o serviço principal NÃO foi pago anteriormente e que não há agendamento pago a vincular. Criar cobrança pelo valor registrado?'))void agir({action:'cobrar-principal',confirmarSemPagamentoAnterior:true})}}>Gerar cobrança principal</Button>}
   {equipe&&<Button size="sm" disabled={busy||!data.pendencias||data.pendencias.length>0} onClick={()=>{if(window.confirm('Encerrar financeiramente a comanda?'))void agir({action:'fechar-financeiro'})}}>Encerrar comanda financeira</Button>}
   </>}
   <p className="text-xs text-muted-foreground">O registro de saída do pet é independente da situação financeira.</p>
  </div>
  <h4 className="font-semibold text-sm">Serviços adicionais</h4>
  {!equipe&&!data.fechadaEm&&grupo.length>=2&&<Button disabled={busy} onClick={()=>{if(window.confirm('Autorizar e pagar os adicionais selecionados por '+brl(data.extras.filter(x=>grupo.includes(x.id)).reduce((a,x)=>a+x.precoCentavos/100,0))+'?'))void agir({action:'pagar-grupo',extraIds:grupo})}}>Autorizar e pagar selecionados ({grupo.length})</Button>}
  {!data.extras.length&&<p className="text-xs text-muted-foreground">Nenhum adicional solicitado.</p>}
  {data.extras.map(x=><div key={x.id} className="rounded-lg border p-3 space-y-2 text-sm">
   {!equipe&&!data.fechadaEm&&!x.venda&&x.precoCentavos>0&&((data.permiteSolicitar&&x.status==='aguardando_tutor')||x.status==='autorizado')&&<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={grupo.includes(x.id)} disabled={busy} onChange={e=>setGrupo(old=>e.target.checked?[...old,x.id]:old.filter(id=>id!==x.id))}/> Incluir no pagamento agrupado</label>}
   <div className="flex justify-between"><b>{x.nome}</b><b>{brl(x.precoCentavos/100)}</b></div><p className="text-xs">{x.duracaoMinutos>0?x.duracaoMinutos+' min · ':''}{label(x.status)}</p>{x.motivo&&<p className="text-xs text-muted-foreground">{x.motivo}</p>}
   {data.permiteSolicitar&&!equipe&&x.status==='aguardando_tutor'&&<div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>void agir({action:'responder',extraId:x.id,aceitar:false})}>Recusar</Button><Button size="sm" disabled={busy} onClick={()=>{if(window.confirm('Autorizar '+x.nome+' por '+brl(x.precoCentavos/100)+'?'))void agir({action:'responder',extraId:x.id,aceitar:true})}}>Autorizar e pagar</Button></div>}
   {data.permiteSolicitar&&equipe&&x.status==='aguardando_equipe'&&<div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>void agir({action:'confirmar-equipe',extraId:x.id,aceitar:false})}>Recusar</Button><Button size="sm" disabled={busy} onClick={()=>{if(window.confirm('Confirma que há tempo e profissional disponível para este serviço?'))void agir({action:'confirmar-equipe',extraId:x.id,aceitar:true})}}>Confirmar disponibilidade</Button></div>}
   {data.aberto&&equipe&&x.status==='autorizado'&&x.liberado&&<Button size="sm" disabled={busy} onClick={()=>{if(window.confirm('Confirma que este serviço liberado foi realizado?'))void agir({action:'realizar',extraId:x.id})}}>Registrar como realizado</Button>}
   {x.pago&&<p className="text-xs text-green-700">Pagamento aprovado pelo Mercado Pago.</p>}
   {x.pendenteFinanceiro&&<p className="text-xs font-medium text-amber-700">Autorizado · aguardando pagamento real. Não realizar o adicional até a aprovação.</p>}
   {x.venda&&!x.pago&&<p className="text-xs">Cobrança: {label(x.venda.status)}</p>}
   {!equipe&&['autorizado','realizado'].includes(x.status)&&x.precoCentavos>0&&(!x.venda||x.venda.status==='pendente')&&<Button size="sm" disabled={busy} onClick={()=>x.venda?setPagamento(x.venda):void agir({action:'cobrar',extraId:x.id})}>Pagar adicional</Button>}
  </div>)}
  {data.permiteSolicitar&&<div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">{equipe?'Sugerir serviço e solicitar aceite':'Solicitar outro serviço'}</p><select aria-label="Serviço adicional" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={servico} onChange={e=>setServico(e.target.value)}><option value="">Escolha o serviço</option>{data.servicos.map(s=><option key={s.chave} value={s.chave}>{s.nome} · {brl(s.precoCentavos/100)} · {s.duracaoMinutos} min</option>)}</select><Input placeholder="Motivo ou observação (opcional)" value={motivo} maxLength={300} onChange={e=>setMotivo(e.target.value)}/><p className="text-xs text-muted-foreground">A equipe confirma o tempo e o profissional antes de realizar o adicional.</p><Button size="sm" disabled={busy||!servico} onClick={()=>{if(!window.confirm(equipe?'Confirma que a equipe tem tempo e profissional para este serviço?':'Solicitar este serviço pelo preço informado?'))return;void agir({action:'solicitar',chave:servico,motivo})}}>{equipe?'Enviar para autorização':'Solicitar serviço'}</Button></div>}
  <h4 className="flex items-center gap-2 font-semibold text-sm"><ShoppingBag className="size-4"/>Compras para entregar junto ao pet</h4>
  {!data.vendas.length&&<p className="text-xs text-muted-foreground">Nenhum produto comprado nesta visita.</p>}
  {data.vendas.map(v=><div key={v.id} className="rounded-lg border p-3 text-sm space-y-1"><div className="flex justify-between"><b>{brl(v.total)}</b><Badge variant="outline">{label(v.status)}</Badge></div>{v.itens?.map((i,j)=><p key={j} className="text-xs">{i.quantidade}× {i.produto.nome}</p>)}{v.status==='concluida'&&<p className="text-xs text-green-700"><CheckCircle2 className="inline size-3"/> Separar e entregar junto ao pet.</p>}{!equipe&&v.status==='pendente'&&<Button size="sm" variant="outline" onClick={()=>setPagamento(v)}>Continuar pagamento</Button>}</div>)}
  {data.aberto&&<div className="rounded-lg border p-3 space-y-2"><Input placeholder="Buscar produtos disponíveis" value={busca} onChange={e=>setBusca(e.target.value)}/><select aria-label="Produto da loja" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={produto} disabled={busy} onChange={e=>{setProduto(e.target.value);compraKey.current=null}}><option value="">Selecione o produto</option>{produtos.filter(p=>!busca||p.nome.toLowerCase().includes(busca.toLowerCase())||p.id===produto).slice(0,100).map(p=><option key={p.id} value={p.id}>{p.nome} · {brl(p.precoPromo??p.preco)}</option>)}</select><Input aria-label="Quantidade" type="number" min={1} max={selecionado?.estoque||1} value={quantidade} disabled={busy} onChange={e=>{setQuantidade(Number(e.target.value));compraKey.current=null}}/>{selecionado&&<p className="text-sm font-semibold">Total estimado: {brl((selecionado.precoPromo??selecionado.preco)*quantidade)}</p>}<Button size="sm" disabled={busy||!selecionado||quantidade<1||quantidade>selecionado.estoque||!Number.isInteger(quantidade)} onClick={()=>void comprar()}>{equipe?'Adicionar à comanda':'Comprar e pagar no site'}</Button></div>}
  {equipe&&[data.principalVenda,...data.extras.map(x=>x.venda),...data.vendas].filter((v):v is Sale=>!!v&&v.status==='pendente'&&!!v.mercadoPagoPaymentUrl).filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i).map(v=><Button key={v.id} size="sm" variant="outline" onClick={async()=>{try{const u=new URL(v.mercadoPagoPaymentUrl!);if(u.protocol!=='https:')throw Error();await navigator.clipboard.writeText(u.href);toast.success('Link de pagamento copiado.')}catch{toast.error('Link indisponível.')}}}>Copiar link do pagamento · {brl(v.total)}</Button>)}
  {pagamento&&!equipe&&<PagamentoCheckout key={pagamento.id} vendaId={pagamento.id} total={pagamento.total} onAprovado={()=>{setPagamento(null);void load()}} onCancelar={()=>{setPagamento(null);void load()}}/>}
 </section>
}
export function MinhasComandas(){
 const [items,setItems]=useState<Array<{id:string}>>([])
 const [falha,setFalha]=useState(false)
 useEffect(()=>{
  let live=true
  const load=()=>portalRequest<{items:Array<{id:string}>}>('/api/comandas').then(r=>{
   if(!live)return
   if(!Array.isArray(r?.items))throw Error('Resposta inválida da comanda.')
   setItems(r.items.filter(p=>typeof p?.id==='string'&&p.id.length>0))
   setFalha(false)
  }).catch(()=>{if(live)setFalha(true)})
  void load()
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},15000)
  return()=>{live=false;clearInterval(timer)}
 },[])
 return <>{falha&&<p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">Não foi possível consultar suas comandas. Os agendamentos continuam disponíveis.</p>}{items.map(p=><ComandaAtendimento key={p.id} processoId={p.id}/>)}</>
}
