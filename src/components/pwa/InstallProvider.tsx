'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Check, Download, Loader2, MoreVertical, PlusSquare, Share, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/components/providers/AuthProvider'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type Platform = 'ios' | 'android' | 'safari' | 'desktop'
type InstallContextValue = { installed: boolean; ready: boolean; openInstall: () => void }
const InstallContext = createContext<InstallContextValue | null>(null)
const DISMISSED_KEY = 'matilha:install:dismissed:v1'
const SEEN_KEY = 'matilha:install:seen:v1'
const REMIND_AFTER = 7 * 24 * 60 * 60 * 1000

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)) return 'safari'
  return 'desktop'
}

function wasDismissedRecently() {
  try {
    const dismissed = Number(localStorage.getItem(DISMISSED_KEY))
    return dismissed > 0 && Date.now() - dismissed < REMIND_AFTER
  } catch {
    return false
  }
}

function rememberDismissal() {
  try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* Storage may be disabled. */ }
}

function InstallationSteps({ platform }: { platform: Platform }) {
  const steps = platform === 'ios'
    ? [
        { icon: Share, title: 'Abra o menu de compartilhamento', description: 'No Safari, toque em Compartilhar. Se o site estiver dentro de outro aplicativo, abra-o no Safari primeiro.' },
        { icon: PlusSquare, title: 'Escolha “Adicionar à Tela de Início”', description: 'Role as opções, se necessário. Se aparecer “Abrir como App”, deixe ativado.' },
        { icon: Check, title: 'Confirme em “Adicionar”', description: 'A logo da Matilha Prado aparecerá na sua tela inicial.' },
      ]
    : platform === 'android'
      ? [
          { icon: MoreVertical, title: 'Abra o menu do navegador', description: 'No Chrome, toque nos três pontos. Dentro do Instagram ou WhatsApp, abra o site no navegador primeiro.' },
          { icon: PlusSquare, title: 'Toque em “Instalar app”', description: 'A opção também pode aparecer como “Adicionar à tela inicial”.' },
          { icon: Check, title: 'Confirme a instalação', description: 'Depois, abra a Matilha Prado pelo ícone com a nossa logo.' },
        ]
      : platform === 'safari'
        ? [
            { icon: Share, title: 'Abra o menu “Arquivo” no Safari', description: 'Em versões recentes do macOS, escolha “Adicionar ao Dock”.' },
            { icon: Check, title: 'Confirme em “Adicionar”', description: 'A Matilha Prado ficará no Dock com a nossa logo. Se a opção não estiver disponível, use o Chrome ou o Edge.' },
          ]
        : [
            { icon: Download, title: 'Procure a opção de instalar no navegador', description: 'No Chrome ou Edge, use o ícone de instalação na barra de endereço ou a opção “Instalar” no menu do navegador.' },
            { icon: Check, title: 'Confirme a instalação', description: 'O sistema abrirá em uma janela própria, com a logo da Matilha Prado. Se seu navegador não oferecer essa opção, abra o site no Chrome ou Edge.' },
          ]

  return (
    <ol className="space-y-5 text-left">
      {steps.map(({ icon: Icon, title, description }, index) => (
        <li key={title} className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary dark:text-cyan-200" aria-hidden="true"><Icon className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold leading-5">{index + 1}. {title}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [canPrompt, setCanPrompt] = useState(false)
  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState(false)
  const [busy, setBusy] = useState(false)
  const deferredPrompt = useRef<InstallPromptEvent | null>(null)
  const shownThisVisit = useRef(false)
  const returnFocusTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Register one listener for the entire app, including navigation and login.
    const beforeInstall = (event: Event) => {
      event.preventDefault()
      deferredPrompt.current = event as InstallPromptEvent
      setCanPrompt(true)
    }
    const appInstalled = () => {
      deferredPrompt.current = null
      setCanPrompt(false)
      setInstalled(true)
      setOpen(false)
      rememberDismissal()
      toast.success('Matilha Prado adicionada! Procure nossa logo no seu dispositivo.')
    }
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const syncDisplayMode = () => {
      const standalone = isStandalone()
      setInstalled(standalone)
      if (standalone) setOpen(false)
    }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', appInstalled)
    displayMode.addEventListener('change', syncDisplayMode)
    // Defer browser-only state until after hydration.
    const initialize = window.setTimeout(() => {
      syncDisplayMode()
      setPlatform(detectPlatform())
      setReady(true)
      try { shownThisVisit.current = sessionStorage.getItem(SEEN_KEY) === '1' } catch { /* Use the in-memory guard. */ }
    }, 0)
    return () => {
      window.clearTimeout(initialize)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', appInstalled)
      displayMode.removeEventListener('change', syncDisplayMode)
    }
  }, [])

  const openInstall = useCallback(() => {
    if (isStandalone()) return
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    shownThisVisit.current = true
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* Use the in-memory guard. */ }
    setInstructions(false)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!ready || loading || installed || pathname !== '/' || shownThisVisit.current || wasDismissedRecently()) return
    // Never interrupt a login form, an open menu or an inactive browser tab.
    const timer = window.setTimeout(() => {
      if (shownThisVisit.current || isStandalone() || wasDismissedRecently() || document.visibilityState !== 'visible') return
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return
      openInstall()
    }, 3500)
    return () => window.clearTimeout(timer)
  }, [ready, loading, installed, pathname, openInstall])

  const dismiss = () => {
    rememberDismissal()
    setOpen(false)
  }

  const install = async () => {
    const prompt = deferredPrompt.current
    if (!prompt) {
      setInstructions(true)
      return
    }
    setBusy(true)
    deferredPrompt.current = null
    setCanPrompt(false)
    try {
      // The native dialog must be opened directly from the user's click.
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') {
        rememberDismissal()
        setOpen(false)
      } else {
        dismiss()
      }
    } catch {
      setInstructions(true)
      toast.info('Você também pode adicionar pelo menu do navegador. Veja o passo a passo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <InstallContext.Provider value={{ installed, ready, openInstall }}>
      {children}
      <Dialog open={open && !installed} onOpenChange={value => { if (!value) dismiss() }}>
        <DialogContent
          className="install-dialog translate-y-0 gap-0 overflow-y-auto rounded-3xl border-0 p-0 sm:max-w-[440px] sm:translate-y-[-50%]"
          onCloseAutoFocus={event => {
            event.preventDefault()
            if (returnFocusTo.current?.isConnected) returnFocusTo.current.focus({ preventScroll: true })
          }}
        >
          <div className="install-dialog-brand px-6 pb-6 pt-8 sm:px-8">
            <Image src="/icons/matilha-192.png" alt="Logo da Matilha Prado" width={80} height={80} className="mx-auto rounded-2xl bg-white shadow-xl shadow-black/10" />
            <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-cyan-100"><Smartphone className="size-4" /> Matilha Prado com você</p>
          </div>
          <div className="p-6 sm:p-8">
            <DialogTitle className="text-center text-2xl font-bold leading-tight tracking-tight">
              {instructions ? 'Como adicionar o atalho' : 'Adicionar à tela inicial?'}
            </DialogTitle>
            <DialogDescription className="mt-3 text-center text-base leading-relaxed">
              {instructions ? 'Siga os passos no seu navegador.' : 'Abra a Matilha Prado pela nossa logo. Sua loja, seus agendamentos e seus pets a um toque.'}
            </DialogDescription>
            {instructions ? (
              <div className="mt-6"><InstallationSteps platform={platform} /></div>
            ) : (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
                <Image src="/icons/matilha-192.png" alt="" width={48} height={48} className="rounded-xl border border-border bg-white" />
                <div className="min-w-0"><p className="text-sm font-semibold">Matilha Prado</p><p className="mt-0.5 text-sm text-muted-foreground">Este será o ícone do seu atalho</p></div>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              {instructions ? (
                <Button size="lg" onClick={dismiss} className="w-full">Entendi</Button>
              ) : (
                <>
                  <Button size="lg" onClick={install} disabled={busy} className="w-full">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    {busy ? 'Aguardando confirmação…' : canPrompt ? 'Instalar agora' : 'Ver como adicionar'}
                  </Button>
                  <Button size="lg" variant="ghost" onClick={dismiss} disabled={busy} className="w-full text-muted-foreground">Agora não</Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </InstallContext.Provider>
  )
}

export function useInstall() {
  const context = useContext(InstallContext)
  if (!context) throw new Error('useInstall must be used within InstallProvider')
  return context
}
