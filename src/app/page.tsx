import { cookies } from 'next/headers'
import { COOKIE_NAME } from '@/lib/auth-cookies'
import { HomeEntry } from '@/components/auth/HomeEntry'

export default async function Home() {
  return <HomeEntry mayHaveSession={(await cookies()).has(COOKIE_NAME)} />
}
