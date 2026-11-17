// A autorização operacional é por e-mail E perfil KANBAN (nunca apenas pelo nome).
export const ANDRE_OPERATIONS_EMAIL = 'andreflavieira21@gmail.com'
export const ALEKSANDER_OPERATIONS_EMAIL = 'aleksanderprado97@icloud.com'
const OLD_ANDRE_OPERATIONS_EMAIL = 'andre.matilhaprado@gmail.com'
const operationalEmails = [ANDRE_OPERATIONS_EMAIL, ALEKSANDER_OPERATIONS_EMAIL]
export type OperationalIdentity = { role: string; email: string } | null | undefined

export function isOperationalEmail(email: string): boolean {
  return operationalEmails.includes(email.trim().toLowerCase())
}

export function isOperationalOperator(user: OperationalIdentity): boolean {
  return user?.role === 'KANBAN' && isOperationalEmail(user.email)
}

// Compatibilidade para testes e referências anteriores.
export function isAndreOperator(user: OperationalIdentity): boolean {
  return user?.role === 'KANBAN' && user.email.trim().toLowerCase() === ANDRE_OPERATIONS_EMAIL
}

export function canViewAppointments(user: OperationalIdentity): boolean {
  return user?.role === 'ADMIN' || isOperationalOperator(user)
}
export function canScheduleBath(user: OperationalIdentity): boolean {
  return user?.role === 'ADMIN' || isOperationalOperator(user)
}
export function canViewDeliveryAddresses(user: OperationalIdentity): boolean {
  return user?.role === 'ADMIN' || isOperationalOperator(user)
}
export function roleForTeamInvitation(email: string): 'KANBAN' | 'ADMIN' {
  return [...operationalEmails, OLD_ANDRE_OPERATIONS_EMAIL].includes(email.trim().toLowerCase()) ? 'KANBAN' : 'ADMIN'
}
