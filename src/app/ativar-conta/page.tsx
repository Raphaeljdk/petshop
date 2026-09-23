import type { Metadata } from 'next'
import { ActivateClientAccount } from '@/components/auth/ActivateClientAccount'
export const metadata: Metadata = { title: 'Ativar acesso | Matilha Prado', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default function ActivatePage() { return <ActivateClientAccount /> }
