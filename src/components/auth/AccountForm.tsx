'use client'

import { useEffect, useId, useRef, useState, type ComponentProps, type FormEvent } from 'react'
import {
  ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, LockKeyhole,
  Mail, MapPin, PawPrint, Phone, ShieldCheck, UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthRequestError, useAuth } from '@/components/providers/AuthProvider'
import { adminRegistrationSchema, clientRegistrationSchema, fieldErrors, formatCpfCnpj, formatPhone, loginSchema, passwordRules } from '@/lib/auth-validation'
import { cn } from '@/lib/utils'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
import { PrivacyNotice } from './PrivacyNotice'
import { RegistrationAddressFields } from './RegistrationAddressFields'

export type AccountMode = 'login' | 'cadastro'
export type AccountRole = 'CLIENTE' | 'ADMIN'

function Field({ label, icon: Icon, error, hint, password = false, ...props }: ComponentProps<typeof Input> & {
  label: string; icon: LucideIcon; error?: string; hint?: string; password?: boolean
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  return <div className="account-field min-w-0">
    <label htmlFor={id} className="mb-2 block text-sm font-medium">{label}</label>
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-3.5 size-[18px] text-muted-foreground" aria-hidden="true" />
      <Input {...props} id={id} type={password ? (visible ? 'text' : 'password') : props.type}
        aria-invalid={!!error} aria-describedby={error || hint || capsLock ? id + '-hint' : undefined}
        onKeyUp={event => { if (password) setCapsLock(event.getModifierState('CapsLock')) }}
        onBlur={() => setCapsLock(false)}
        className={cn('h-12 rounded-xl pl-11 text-base', password && 'pr-12', error && 'border-destructive', props.className)} />
      {password && <button type="button" disabled={props.disabled} aria-label={visible ? 'Ocultar ' + label.toLowerCase() : 'Mostrar ' + label.toLowerCase()}
        aria-pressed={visible} onClick={() => setVisible(value => !value)}
        className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>}
    </div>
    {(error || hint || capsLock) && <p id={id + '-hint'} className={cn('mt-1.5 text-xs leading-relaxed', error ? 'text-destructive' : 'text-muted-foreground')}>
      {error || (capsLock ? 'Caps Lock está ativado.' : hint)}
    </p>}
  </div>
}

export function AccountForm({ initialMode = 'login', initialRole = 'CLIENTE', onSuccess, onBusyChange }: {
  initialMode?: AccountMode; initialRole?: AccountRole; onSuccess?: () => void; onBusyChange?: (busy: boolean) => void
}) {
  const { login, cadastrar } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [role, setRole] = useState(initialRole)
  const [busy, setBusy] = useState(false)
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [help, setHelp] = useState(false)
  const [data, setData] = useState({ nome: '', email: '', telefone: '', identificador: '', cpfCnpj: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', senha: '', confirmarSenha: '', convite: '' })
  const inFlight = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  const isAdmin = role === 'ADMIN'
  const isRegister = mode === 'cadastro'
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('authError')
    const messages: Record<string, string> = {
      'google-unavailable': 'Não foi possível entrar com Google. Tente novamente ou use seu e-mail e senha.',
      'google-session-expired': 'A sessão do Google expirou. Clique novamente em Continuar com Google.',
      'google-cancelled': 'Entrada com Google cancelada.',
      'google-invalid': 'Não foi possível confirmar a identidade com Google. Tente novamente.',
      'google-existing-account': 'Você já possui cadastro na Matilha Prado. Entre com seu e-mail/telefone e senha e depois vincule o Google no portal.',
      'google-login-required': 'Entre na sua conta de cliente antes de vincular o Google.',
      'google-email-different': 'Para vincular o Google, utilize uma conta Google com o mesmo e-mail do cadastro Matilha Prado.',
      'google-already-linked': 'Esta conta Google já está vinculada a outro acesso, ou você já vinculou outra conta.',
    }
    if (code && messages[code]) setMessage(messages[code])
  }, [])
  const update = (name: keyof typeof data, value: string) => {
    setData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
    setMessage('')
  }
  const changeView = (nextMode: AccountMode, nextRole = role) => {
    if (busy) return
    setMode(nextMode)
    setRole(nextRole)
    setData(prev => ({ ...prev, senha: '', confirmarSenha: '', convite: '' }))
    setErrors({})
    setMessage('')
    setHelp(false)
  }
  const showErrors = (fields: Record<string, string>, text: string) => {
    setErrors(fields)
    setMessage(text)
    requestAnimationFrame(() => {
      const first = Object.keys(fields).find(key => key !== 'form')
      const input = first ? formRef.current?.elements.namedItem(first) : null
      if (input instanceof HTMLElement) {
        const details = input.closest('details')
        if (details) details.open = true
        input.focus()
      }
      else messageRef.current?.focus()
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const input = isRegister
      ? { nome: data.nome, email: data.email, senha: data.senha, confirmarSenha: data.confirmarSenha, role,
          ...(isAdmin ? { convite: data.convite } : { telefone: data.telefone, cpfCnpj: data.cpfCnpj, cep: data.cep, logradouro: data.logradouro, numero: data.numero, complemento: data.complemento, bairro: data.bairro, cidade: data.cidade, uf: data.uf }) }
      : isAdmin
        ? { role: 'ADMIN' as const, email: data.email, senha: data.senha, lembrar: remember }
        : { role: 'CLIENTE' as const, identificador: data.identificador, senha: data.senha, lembrar: remember }
    const parsed = (isRegister ? (isAdmin ? adminRegistrationSchema : clientRegistrationSchema) : loginSchema).safeParse(input)
    if (!parsed.success) { showErrors(fieldErrors(parsed.error), 'Confira os campos abaixo para continuar.'); return }
    inFlight.current = true
    setBusy(true)
    onBusyChange?.(true)
    setMessage('')
    setErrors({})
    try {
      if (isRegister) {
        await cadastrar({
          nome: data.nome, email: data.email, senha: data.senha, confirmarSenha: data.confirmarSenha, role,
          ...(isAdmin ? { convite: data.convite } : { telefone: data.telefone, cpfCnpj: data.cpfCnpj, cep: data.cep, logradouro: data.logradouro, numero: data.numero, complemento: data.complemento, bairro: data.bairro, cidade: data.cidade, uf: data.uf }),
        })
      } else {
        await login(parsed.data as Parameters<typeof login>[0])
      }
      setData(prev => ({ ...prev, senha: '', confirmarSenha: '', convite: '' }))
      onSuccess?.()
    } catch (error) {
      showErrors(error instanceof AuthRequestError ? error.fields : {}, error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.')
    } finally {
      inFlight.current = false
      setBusy(false)
      onBusyChange?.(false)
    }
  }

  const ruleCount = passwordRules.filter(rule => rule.test(data.senha)).length
  return <div className="account-form-body">
    <div className="mb-7">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {isAdmin ? <ShieldCheck className="size-4" /> : <PawPrint className="size-4" />}
        {isAdmin ? 'Espaço da equipe' : 'Espaço do cliente'}
      </p>
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {isRegister ? (isAdmin ? 'Cadastre seu acesso.' : 'Entre para a matilha.') : 'Que bom ter você aqui.'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {isRegister
          ? isAdmin ? 'Use o convite da administração para criar sua conta de trabalho.' : 'Crie sua conta e cuide da rotina do seu pet com a gente.'
          : isAdmin
            ? 'Entre com seu e-mail ou usuário e senha. Contas da agenda abrem somente o Kanban.'
            : 'A rotina do seu melhor amigo, pertinho de você. Entre com seu e-mail ou telefone e sua senha.'}
      </p>
    </div>

    <div className="mb-6 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de conta">
      {([{ value: 'CLIENTE', title: 'Sou cliente', subtitle: 'Pets e agendamentos', icon: PawPrint },
        { value: 'ADMIN', title: isRegister ? 'Sou administrador' : 'Equipe / administração', subtitle: isRegister ? 'Gestão da loja' : 'Administração ou agenda', icon: ShieldCheck }] as const).map(item => (
        <button key={item.value} type="button" disabled={busy} aria-pressed={role === item.value}
          onClick={() => changeView(mode, item.value)}
          className={cn('account-role rounded-xl border p-3 text-left transition-colors', role === item.value && 'account-role-active')}>
          <item.icon className="mb-2 size-5" aria-hidden="true" />
          <span className="block text-xs font-semibold sm:text-sm">{item.title}</span>
          <span className="mt-1 hidden text-xs text-muted-foreground sm:block">{item.subtitle}</span>
        </button>
      ))}
    </div>

    {!isAdmin && <>
      <a href={'/api/auth/google?intent=' + (isRegister ? 'cadastro' : 'login')}
        className="mb-4 flex h-12 w-full items-center justify-center gap-3 rounded-xl border bg-background text-sm font-semibold shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        <span aria-hidden="true" className="text-lg font-bold text-[#4285F4]">G</span>
        Continuar com Google
      </a>
      <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" /> ou continue com e-mail <span className="h-px flex-1 bg-border" />
      </div>
    </>}

    <form ref={formRef} onSubmit={submit} noValidate aria-busy={busy} className="space-y-4 sm:space-y-5">
      {message && <div ref={messageRef} tabIndex={-1} role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive outline-none">{message}</div>}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">{isRegister ? 'Dados de cadastro' : 'Dados de acesso'}</legend>
        {isRegister && <Field label="Nome completo" icon={UserRound} name="nome" autoComplete="name" required maxLength={100}
          placeholder="Como podemos chamar você?" value={data.nome} onChange={e => update('nome', e.target.value)} error={errors.nome} />}
        {(isRegister || isAdmin) && <Field
          label={!isRegister && isAdmin ? 'E-mail ou usuário' : 'E-mail'}
          icon={Mail}
          name="email"
          type={!isRegister && isAdmin ? 'text' : 'email'}
          autoComplete="username"
          required
          maxLength={254}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={!isRegister && isAdmin ? 'Seu acesso da equipe' : 'voce@exemplo.com'}
          value={data.email}
          onChange={e => update('email', e.target.value)}
          error={errors.email}
          hint={isRegister && isAdmin ? 'Use o mesmo e-mail que recebeu o convite.' : undefined}
        />}
        {!isRegister && !isAdmin && <Field label="E-mail ou telefone" icon={Mail} name="identificador" type="text" autoComplete="username" required
          maxLength={254} autoCapitalize="none" spellCheck={false} placeholder="voce@exemplo.com ou (11) 99999-9999"
          value={data.identificador} onChange={e => update('identificador', e.target.value)} error={errors.identificador}
          hint="Use o mesmo e-mail ou telefone vinculado à sua conta." />}
        {isRegister && !isAdmin && <Field label="Telefone com DDD" icon={Phone} name="telefone" type="tel" autoComplete="tel-national" required
          placeholder="(11) 99999-9999" value={data.telefone} onChange={e => update('telefone', formatPhone(e.target.value))} error={errors.telefone} />}
        {isRegister && !isAdmin && <Field label="CPF ou CNPJ" icon={UserRound} name="cpfCnpj" inputMode="numeric" required
          placeholder="000.000.000-00" value={data.cpfCnpj} onChange={e => update('cpfCnpj', formatCpfCnpj(e.target.value))} error={errors.cpfCnpj}
          hint="Para localizar seu cadastro na loja e emitir seus pedidos." />}
        {isRegister && isAdmin && <Field label="Código de convite" icon={KeyRound} name="convite" autoComplete="off" required maxLength={64}
          spellCheck={false} autoCapitalize="none" placeholder="Cole o código fornecido pela administração" value={data.convite}
          onChange={e => update('convite', e.target.value.trim())} error={errors.convite}
          hint="O convite vale por 48 horas e só pode ser usado uma vez." />}
        <div className={cn(isRegister && 'grid grid-cols-1 gap-4 sm:grid-cols-2')}>
          <Field key={mode + role + '-senha'} label="Senha" icon={LockKeyhole} name="senha" password required maxLength={isRegister ? 72 : 256}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder={isRegister ? 'Crie uma senha' : 'Sua senha'} value={data.senha} onChange={e => update('senha', e.target.value)} error={errors.senha} />
          {isRegister && <Field key={role + '-confirmar'} label="Confirmar senha" icon={LockKeyhole} name="confirmarSenha" password required maxLength={72}
            autoComplete="new-password" placeholder="Repita sua senha" value={data.confirmarSenha} onChange={e => update('confirmarSenha', e.target.value)} error={errors.confirmarSenha} />}
        </div>
        {isRegister && <div className="rounded-xl bg-muted/65 px-3.5 py-3">
          <div className="mb-2 flex gap-1.5" aria-hidden="true">{[1, 2, 3].map(n => <span key={n} className={cn('h-1 flex-1 rounded-full bg-border transition-colors', data.senha && n <= ruleCount && 'bg-teal-600')} />)}</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {passwordRules.slice(0, 2).map(rule => <li key={rule.label} className={cn('flex items-center gap-1.5', data.senha && rule.test(data.senha) && 'text-teal-700 dark:text-teal-300')}>
              <Check className="size-3.5" aria-hidden="true" />{rule.label}
            </li>)}
          </ul>
        </div>}
        {isRegister && !isAdmin && <RegistrationAddressFields value={data} onChange={update} errors={errors} disabled={busy} />}
        {!isRegister && <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-xs">
          <label className="flex cursor-pointer items-center gap-2">
            <input name="lembrar" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="size-4 rounded accent-primary" />
            Manter conectado por 7 dias
          </label>
          <button type="button" onClick={() => setHelp(value => !value)} aria-expanded={help} className="font-medium text-primary hover:underline">Preciso de ajuda</button>
        </div>}
        {help && <div className="rounded-xl bg-muted p-3 text-sm leading-relaxed text-muted-foreground">
          <p>{isAdmin
            ? 'Confira seu e-mail/usuário e o Caps Lock. Se perdeu sua senha, procure a administração.'
            : 'Confira o e-mail ou telefone usado no cadastro e o Caps Lock. Esqueceu a senha? Nossa equipe orienta você a recuperar o acesso.'}</p>
          {!isAdmin && <a href={matilhaWhatsAppUrl('Olá! Já tenho conta na Matilha Prado e preciso de ajuda para acessar.')} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center rounded-md font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">Conversar com a equipe<span className="sr-only"> (WhatsApp, nova aba)</span></a>}
          {!isAdmin && <p className="text-xs">Sua senha é só sua. Não envie sua senha pelo atendimento.</p>}
        </div>}
        <Button type="submit" disabled={busy} className="account-submit h-12 w-full rounded-xl text-sm font-semibold">
          {busy ? <><Loader2 className="size-4 animate-spin" /> {isRegister ? 'Criando sua conta...' : 'Entrando...'}</>
            : <>{isRegister ? (isAdmin ? 'Criar conta de administrador' : 'Criar minha conta') : 'Entrar na minha conta'}<ArrowRight className="size-4" /></>}
        </Button>
      </fieldset>
      <p className="pt-1 text-center text-sm text-muted-foreground">
        {isRegister ? 'Já tem uma conta?' : 'Primeira vez por aqui?'}{' '}
        <button type="button" disabled={busy} className="font-semibold text-primary hover:underline"
          onClick={() => changeView(isRegister ? 'login' : 'cadastro')}>{isRegister ? 'Entrar' : 'Criar conta'}</button>
      </p>
    </form>
    <div className="mt-5">
      <PrivacyNotice />
      {isAdmin && <p className="mt-3 text-xs text-muted-foreground">Acesso exclusivo para pessoas autorizadas pela Matilha Prado.</p>}
    </div>
  </div>
}
