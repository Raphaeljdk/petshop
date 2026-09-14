import type { Metadata } from 'next'
import { AccountPage } from '@/components/auth/AccountPage'

export const metadata: Metadata = { title: 'Entrar | Matilha Prado', robots: { index: false, follow: false } }
export default function LoginPage() { return <AccountPage mode="login" /> }
