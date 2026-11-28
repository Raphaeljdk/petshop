'use client'
import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck2, CalendarClock, Camera, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { portalRequest } from './ExperienceProvider'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
import { toast } from 'sonner'
import { AgendaDateTimePicker } from './AgendaDateTimePicker'
import { horarioSolicitavel } from '@/lib/agenda-horarios-portal'
import { PagamentoCheckout } from './PagamentoCheckout'

export type Booking = {
  id: string
  petName: string
  service: string
  desiredAt: string
  status: string
  confirmedAt: string | null
  confirmationRef: string | null
  reply: string | null
  gravataNome?: string | null
  gravataFoto?: string | null
  gravataIdeia?: string | null
  servicoPrecoCentavos?: number | null
  gravataWhatsStatus?: string
  pagamentoVenda?: {id:string;total:number;status:string;mercadoPagoStatus:string|null}|null
  gravataPrecoCentavos?: number
  pagamentoOnlineObrigatorio?: boolean
  cliente?: { nome: string }
}

type OpcaoServico = { chave: string; nome: string; precoCentavos: number; duracaoMinutos: number }
type CatalogoDisponivel = { motivo: string | null; servicos: OpcaoServico[]; opcoes?: OpcaoServico[]; pendentes?: Array<{chave:string;nome:string}> }

type DirectBookingConfig = {
  configured: boolean
  writeConfigured: boolean
  services: Array<{ id: number; nome: string }>
  fallback: string | null
  catalogo?: CatalogoDisponivel
}

const dateLabel = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })

export function BookingRequests() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [historicoServicos, setHistoricoServicos] = useState<Array<{ petId: string; servico: string; status: string; dataHora: string }>>([])
  const [pets, setPets] = useState<{ id: string; nome: string; raca?:string|null; ativo?:boolean }[]>([])
  const [direct, setDirect] = useState<DirectBookingConfig>({
    configured: false,
    writeConfigured: false,
    services: [],
    fallback: 'solicitacao-equipe',
  })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [petKey, setPetKey] = useState('')
  const [service, setService] = useState('')
  const [catalogo, setCatalogo] = useState<CatalogoDisponivel | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [erroCatalogo, setErroCatalogo] = useState('')
  const [horarioConsultado,setHorarioConsultado]=useState('')
  const [serviceId, setServiceId] = useState('')
  const [desired, setDesired] = useState('')
  const [notes, setNotes] = useState('')
  const [gravataNome,setGravataNome]=useState('')
  const [personalizar, setPersonalizar] = useState(false)
  const [gravataFoto, setGravataFoto] = useState<string | null>(null)
  const [fotoBusy, setFotoBusy] = useState(false)
  const [gravataIdeia,setGravataIdeia]=useState('')
  const [pagamento,setPagamento]=useState<{id:string;total:number}|null>(null)

  const load = useCallback(
    () =>
      Promise.all([
        portalRequest<Booking[]>('/api/cliente/solicitacoes-agendamento'),
        portalRequest<{ id: string; nome: string; raca?:string|null; ativo?:boolean }[]>('/api/cliente/pets'),
        portalRequest<DirectBookingConfig>('/api/cliente/agendamentos/servicos'),
        portalRequest<Array<{ petId: string; servico: string; status: string; dataHora: string }>>('/api/cliente/agendamentos').catch(() => []),
      ])
        .then(([rows, animals, bookingConfig, historico]) => {
          setHistoricoServicos(Array.isArray(historico) ? historico : [])
          setBookings(rows)
          setPets(animals.filter(p=>p.ativo!==false))
          setDirect(bookingConfig)
          setServiceId((current) =>
            current ||
            (bookingConfig.services[0]?.id
              ? String(bookingConfig.services[0].id)
              : ''),
          )
          setReady(true)
        })
        .catch(() => setReady(false)),
    [],
  )

  useEffect(() => {
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    let cancelado = false
    setErroCatalogo(''); setHorarioConsultado('')
    if (!petKey) { setCatalogo(null);setConsultando(false); return }
    const quando=desired?new Date(desired+':00-03:00'):null
    const valido=Boolean(quando&&horarioSolicitavel(quando))
    if(desired&&!valido)setErroCatalogo('Escolha uma data futura nos próximos seis meses.')
    setConsultando(true)
    portalRequest<DirectBookingConfig>('/api/cliente/agendamentos/servicos?petKey='+encodeURIComponent(petKey)+(valido&&quando?'&quando='+encodeURIComponent(quando.toISOString()):''))
      .then(data=>{if(!cancelado){setCatalogo(data.catalogo??null);if(valido)setHorarioConsultado(desired)}})
      .catch(e=>{if(!cancelado)setErroCatalogo(e instanceof Error?e.message:'Erro na consulta.')})
      .finally(()=>{if(!cancelado)setConsultando(false)})
    return ()=>{cancelado=true}
  }, [petKey, desired])

  if (!ready) return null

  const directMode =
    direct.configured && pets.some((pet) => pet.id.startsWith('zetta:'))

  const sugestoesRecentes = Array.from(new Set(historicoServicos
    .filter(item => item.petId === petKey && item.status === 'concluido' && item.servico.trim())
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map(item => item.servico.trim()))).slice(0, 4)

  const disponiveis = catalogo?.opcoes ?? catalogo?.servicos ?? []
  const selecionado = disponiveis.find(s => s.nome === service)
  const horarioDisponivel=Boolean(desired&&horarioConsultado===desired&&catalogo?.servicos.some(s=>s.nome===service))
  const racaPet=pets.find(p=>p.id===petKey)?.raca
  const banho = Boolean(selecionado?.nome.toLowerCase().includes('banho'))
  const adicional = banho && personalizar ? 500 : 0
  const whatsapp = matilhaWhatsAppUrl('Olá! Gostaria de consultar serviços e horários para ' + (pets.find(p => p.id === petKey)?.nome || 'meu pet') + (desired ? ' em ' + desired.replace('T', ' às ') : '') + '.')
  const preco = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {directMode ? (
              <CalendarCheck2 className="size-5 text-primary" />
            ) : (
              <CalendarClock className="size-5 text-primary" />
            )}
            {directMode ? 'Agendar direto no Siggma' : 'Solicitar pelo portal'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {directMode
              ? 'Escolha pet, serviço, data e horário. O Siggma valida o expediente antes de confirmar.'
              : 'Escolha o pet, veja os serviços disponíveis para a raça e depois selecione a data. A equipe confirma a reserva.'}
          </p>
        </div>

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              if (directMode) {
                await portalRequest('/api/cliente/agendamentos', {
                  method: 'POST',
                  body: JSON.stringify({
                    petId: petKey,
                    servicoId: Number(serviceId),
                    quando: desired,
                    observacoes: notes,
                  }),
                })
                toast.success('Agendamento confirmado pelo Siggma.')
                setDesired('')
                setNotes('')
                window.setTimeout(() => window.location.reload(), 700)
              } else {
                await portalRequest('/api/cliente/solicitacoes-agendamento', {
                  method: 'POST',
                  body: JSON.stringify({
                    petKey,
                    service,
                    desiredAt: new Date(desired + ':00-03:00').toISOString(),
                    notes,
                    ...(banho && personalizar && (gravataFoto||gravataNome.trim()) ? { ...(gravataFoto?{gravataFoto}:{}), ...(gravataNome.trim()?{gravataNome:gravataNome.trim()}:{}), gravataIdeia } : {}),
                  }),
                })
                toast.success(
                  'Solicitação enviada. Aguarde a confirmação da equipe no portal.',
                )
                setDesired('')
                setNotes(''); setPersonalizar(false); setGravataFoto(null); setGravataNome(''); setGravataIdeia('')
                await load()
              }
            } catch (error) {
              toast.error((error as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <div>
            <label htmlFor="request-pet" className="text-sm font-medium">Pet</label>
            <select
              id="request-pet"
              required
              className="mt-1 h-11 w-full rounded-md border bg-background px-3"
              value={petKey}
              onChange={(e) => { setDesired('');setPetKey(e.target.value); setCatalogo(null); setService('');setHorarioConsultado('');setPersonalizar(false);setGravataFoto(null);setGravataNome('');setGravataIdeia('') }}
            >
              <option value="">Selecione seu pet</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}{p.raca?' · '+p.raca:''}</option>
              ))}
            </select>
            {petKey&&<p className="mt-1 text-xs text-muted-foreground">Raça: {racaPet||'Não informada no cadastro do pet'}</p>}
          </div>

          <div>
            <label htmlFor="request-service" className="text-sm font-medium">Serviço</label>
            {directMode ? (
              <select
                id="request-service"
                required
                className="mt-1 h-11 w-full rounded-md border bg-background px-3"
                value={serviceId}
                onChange={(e) => {setDesired('');setServiceId(e.target.value)}}
              >
                <option value="">Selecione o serviço</option>
                {direct.services.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            ) : (
              <select id="request-service" required disabled={!petKey || (!disponiveis.length && !catalogo?.pendentes?.length)} className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={service} onChange={e => {setDesired('');setHorarioConsultado('');setService(e.target.value)}}>
                <option value="">{consultando ? 'Consultando...' : 'Selecione o serviço'}</option>
                {disponiveis.map(s => <option value={s.nome} key={s.chave}>{s.nome} · {preco(s.precoCentavos)} · {s.duracaoMinutos} min</option>)}
                {catalogo?.pendentes?.map(s=><option key={'pendente-'+s.chave} value={'pendente-'+s.chave} disabled>{s.nome} · Sob consulta</option>)}
              </select>
            )}
            {!directMode && (
              <>
                {selecionado && <p className="mt-1 text-xs text-muted-foreground">Valor: {preco(selecionado.precoCentavos)} · Duração prevista: {selecionado.duracaoMinutos} min.</p>}
                {!petKey&&<p className="mt-1 text-xs text-muted-foreground">Escolha o pet para consultar os serviços.</p>}
                {selecionado&&!desired&&<p className="mt-1 text-xs text-muted-foreground">Agora escolha a data e o horário.</p>}
                {selecionado&&desired&&consultando&&<p className="mt-1 text-xs text-muted-foreground">Conferindo disponibilidade da equipe...</p>}
                {selecionado&&desired&&!consultando&&horarioConsultado===desired&&<p className={'mt-1 text-xs '+(horarioDisponivel?'text-green-700':'text-amber-700')}>{horarioDisponivel?'Horário disponível para solicitação.':'Serviço cadastrado, mas sem profissional disponível neste horário. Escolha outro horário ou fale com a equipe.'}</p>}
                {erroCatalogo && <p className="mt-1 text-xs text-destructive">{erroCatalogo}</p>}
                {catalogo&&!disponiveis.length&&<p className="mt-1 text-xs text-muted-foreground">{catalogo.motivo==='servicos-pendentes'?'A equipe ainda precisa confirmar os preços e tempos dos serviços.':'Não encontramos serviços cadastrados para esta raça.'}</p>}
                {!!catalogo?.pendentes?.length&&<div className="mt-2 rounded-md border p-2 text-xs text-muted-foreground"><p className="font-medium">Serviços cadastrados para esta raça, sob consulta:</p><p className="mt-1">{catalogo.pendentes.map(s=>s.nome).join(" · ")}</p></div>}
                {petKey && !consultando && (!disponiveis.length||(!!selecionado&&!!desired&&!horarioDisponivel)) && <Button asChild variant="outline" size="sm" className="mt-2"><a href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar pelo WhatsApp</a></Button>}
                {sugestoesRecentes.length > 0 && <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium">Últimos serviços concluídos deste pet</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sugestoesRecentes.map(nome => <Button key={nome} type="button" size="sm" variant="outline" disabled={busy || !disponiveis.some(s => s.nome === nome)} onClick={() => {setDesired('');setHorarioConsultado('');setService(nome)}}>{nome}</Button>)}
                  </div>
                </div>}
              </>
            )}
          </div>

          <div>
            <AgendaDateTimePicker key={petKey+'|'+(directMode?serviceId:service)} petKey={petKey} servicoChave={directMode?serviceId:selecionado?.chave||''} direct={directMode} value={desired} disabled={busy} onChange={v=>{setDesired(v);setHorarioConsultado('')}}/>
          </div>

          <div>
            <label htmlFor="request-notes" className="text-sm font-medium">Observações</label>
            <Textarea
              id="request-notes"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {!directMode && banho && <section className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2"><Gift className="size-5 text-primary"/><h3 className="font-semibold">Personalize sua gravata</h3><span className="ml-auto font-semibold text-primary">+ R$ 5,00</span></div>
            <p className="text-sm text-muted-foreground">Uma gravata normal já está inclusa no banho, sem custo adicional. A personalização com foto, nome ou ambos é opcional.</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={personalizar} onChange={e=>{setPersonalizar(e.target.checked);if(!e.target.checked){setGravataFoto(null);setGravataNome('');setGravataIdeia('')}}}/>Quero personalizar minha gravata com foto, nome ou os dois</label>
            {personalizar&&<div className="space-y-1"><label htmlFor="gravata-nome" className="text-sm font-medium">Nome para personalizar (opcional)</label><Input id="gravata-nome" maxLength={80} placeholder="Ex.: Gyda" value={gravataNome} onChange={e=>setGravataNome(e.target.value)}/><p className="text-xs text-muted-foreground">Informe um nome, envie uma foto ou escolha os dois pelo mesmo valor de R$ 5,00.</p></div>}
            {personalizar && <div className="space-y-2"><label htmlFor="gravata-foto" className="flex items-center gap-2 text-sm font-medium"><Camera className="size-4"/>Envie a foto (opcional)</label><Input id="gravata-foto" type="file" accept="image/jpeg,image/png,image/webp" disabled={fotoBusy||busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setFotoBusy(true);setGravataFoto(null);let url='';try{if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Envie JPG, PNG ou WebP de até 10 MB.');url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');const scale=Math.min(1,640/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível abrir a foto.');ctx.drawImage(img,0,0,canvas.width,canvas.height);const foto=canvas.toDataURL('image/jpeg',0.8);if(foto.length>400000)throw Error('Escolha uma foto menor.');setGravataFoto(foto)}catch(e){toast.error(e instanceof Error?e.message:'Foto inválida.')}finally{if(url)URL.revokeObjectURL(url);setFotoBusy(false)}}}/>{gravataFoto&&<img src={gravataFoto} alt="Prévia da foto para a gravata" className="size-24 rounded-lg object-contain border"/>}</div>}
            {personalizar&&<div className="space-y-2"><label htmlFor="gravata-ideia" className="text-sm font-medium">Nos informe sua ideia</label><Textarea id="gravata-ideia" rows={3} maxLength={400} placeholder="Ex.: tema de aniversário, nome do pet, cores favoritas ou uma frase especial..." value={gravataIdeia} onChange={e=>setGravataIdeia(e.target.value)}/><p className="text-xs text-muted-foreground">O nome, a foto e a ideia informados serão encaminhados ao WhatsApp da Matilha Prado somente depois da confirmação do pagamento integral do banho e da personalização. Até lá ficam salvas no agendamento.</p></div>}
          </section>}
          {selecionado && <div className="sm:col-span-2 flex items-center justify-between rounded-lg bg-muted/50 p-3"><span className="text-sm">Total estimado</span><strong>{preco(selecionado.precoCentavos+adicional)}</strong></div>}
          <Button
            type="submit"
            disabled={
              busy || fotoBusy || (banho && personalizar && !gravataFoto && !gravataNome.trim()) ||
              !pets.length ||
              (directMode ? (!desired || !serviceId || !petKey.startsWith('zetta:')) : (consultando || !selecionado || !horarioDisponivel))
            }
          >
            {busy
              ? 'Enviando...'
              : directMode
                ? 'Confirmar agendamento'
                : 'Enviar solicitação'}
          </Button>
        </form>

        {!pets.length && (
          <p className="text-sm text-muted-foreground">
            Cadastre seu pet ou peça à loja para vinculá-lo à sua conta.
          </p>
        )}

        <div className="space-y-3" aria-live="polite">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{b.petName} · {b.service}</h3>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs">
                  {b.status === 'solicitado' ? 'Aguardando confirmação' : b.status}
                </span>
              </div>
              <p className="mt-2 text-sm">Preferência: {dateLabel(b.desiredAt)}</p>
              {!!b.gravataPrecoCentavos && <p className="mt-2 text-sm">Gravata personalizada · {preco(b.gravataPrecoCentavos)}</p>}
              {b.confirmedAt && (
                <p className="text-sm font-semibold text-green-700">
                  Confirmado para {dateLabel(b.confirmedAt)}
                </p>
              )}
              {(b.pagamentoOnlineObrigatorio||!!b.gravataPrecoCentavos)&&<div className="my-3 rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                {b.gravataNome&&<p className="break-words">Nome na gravata: {b.gravataNome}</p>}
                 {b.gravataIdeia&&<p className="break-words">Sua ideia: {b.gravataIdeia}</p>}
                {b.servicoPrecoCentavos!=null&&<p className="font-semibold">Total do agendamento: {preco(b.servicoPrecoCentavos+(b.gravataPrecoCentavos||0))}</p>}
                {!!b.gravataPrecoCentavos&&<p className="text-xs text-muted-foreground">{['entregue','lido'].includes(b.gravataWhatsStatus||'')?'Personalização entregues à equipe.':b.gravataWhatsStatus==='enviado'?'Envio aceito pelo WhatsApp; aguardando entrega.':b.gravataWhatsStatus==='falha_entrega'?'Pagamento confirmado; a equipe precisa conferir a entrega da personalização.':b.pagamentoVenda?.status==='concluida'&&b.pagamentoVenda.mercadoPagoStatus==='approved'?'Pagamento confirmado; encaminhamento aguardando confirmação do WhatsApp.':'Personalização aguardando pagamento integral.'}</p>}
                {b.status==='confirmado'&&b.servicoPrecoCentavos!=null&&b.servicoPrecoCentavos>0&&(!b.pagamentoVenda||b.pagamentoVenda.status==='pendente')&&<Button size="sm" disabled={busy} onClick={async()=>{setBusy(true);try{const v=await portalRequest<{id:string;total:number;status:string}>('/api/cliente/solicitacoes-agendamento/pagamento',{method:'POST',body:JSON.stringify({id:b.id})});if(v.status==='pendente')setPagamento(v);await load()}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível abrir pagamento.')}finally{setBusy(false)}}}>{b.gravataPrecoCentavos?'Pagar serviço e gravata':'Pagar agendamento'}</Button>}
              </div>}
              {b.reply && (
                <p className="mt-2 break-words text-sm">Resposta da loja: {b.reply}</p>
              )}
              {b.status === 'solicitado' && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await portalRequest(
                        '/api/cliente/solicitacoes-agendamento?id=' +
                          encodeURIComponent(b.id),
                        { method: 'DELETE' },
                      )
                      await load()
                    } catch (error) {
                      toast.error((error as Error).message)
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Cancelar solicitação
                </Button>
              )}
            </div>
          ))}
        </div>
        {pagamento&&<PagamentoCheckout key={pagamento.id} vendaId={pagamento.id} total={pagamento.total} onAprovado={()=>{setPagamento(null);void load()}} onCancelar={()=>{setPagamento(null);void load()}}/>}
      </CardContent>
    </Card>
  )
}
