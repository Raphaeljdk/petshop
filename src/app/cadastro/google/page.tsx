import type { Metadata } from 'next'
import { GoogleCompleteRegistration } from '@/components/auth/GoogleCompleteRegistration'

export const metadata: Metadata = {
  title: 'Concluir cadastro com Google | Matilha Prado',
  robots: { index: false, follow: false },
}
export default function GoogleRegistrationPage() {
  return <GoogleCompleteRegistration />
}
