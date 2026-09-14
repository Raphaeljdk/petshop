import type { Metadata } from 'next'
import { AccountPage } from '@/components/auth/AccountPage'

export const metadata: Metadata = { title: 'Cadastro de administrador | Matilha Prado', robots: { index: false, follow: false } }
export default function AdminRegisterPage() { return <AccountPage mode="cadastro" role="ADMIN" /> }
