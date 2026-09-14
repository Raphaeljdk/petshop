import type { Metadata } from 'next'
import { AccountPage } from '@/components/auth/AccountPage'

export const metadata: Metadata = { title: 'Cadastro de cliente | Matilha Prado', robots: { index: false, follow: false } }
export default function RegisterPage() { return <AccountPage mode="cadastro" /> }
