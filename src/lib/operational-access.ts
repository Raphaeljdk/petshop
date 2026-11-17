// Permissões mínimas para o login individual da operação.
// A checagem deve ocorrer no servidor em cada rota; a interface é apenas uma conveniência.
export const ANDRE_OPERATIONS_EMAIL = 'andreflavieira21@gmail.com'
// Convites antigos nunca podem receber perfil ADMIN por engano.
const OLD_ANDRE_OPERATIONS_EMAIL = 'andre.matilhaprado@gmail.com'

export type OperationalIdentity = { role: string; email: string } | null | undefined

export function isAndreOperator(user: OperationalIdentity): boolean {
  return user?.role === 'KANBAN' && user.email.trim().toLowerCase() === ANDRE_OPERATIONS_EMAIL
}

export function canViewAppointments(user: OperationalIdentity): boolean {
  return user?.role === 'ADMIN' || isAndreOperator(user)
}

export function canScheduleBath(user: OperationalIdentity): boolean {
  return user?.role === 'ADMIN' || isAndreOperator(user)
}

export function canViewDeliveryAddresses(user: OperationalIdentity): boolean {
  return user?.role === 'ADMIN' || isAndreOperator(user)
}

// O convite de administrador nunca pode elevar este login operacional a ADMIN.
export function roleForTeamInvitation(email: string): 'KANBAN' | 'ADMIN' {
  return [ANDRE_OPERATIONS_EMAIL, OLD_ANDRE_OPERATIONS_EMAIL].includes(email.trim().toLowerCase()) ? 'KANBAN' : 'ADMIN'
}
