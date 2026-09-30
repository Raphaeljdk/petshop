import { PrismaClient } from '@prisma/client'
import { spawnSync } from 'node:child_process'

const prisma = new PrismaClient()

const baselineMigrations = [
  '20260921170000_add_cupons',
  '20260921232000_add_siggma_client_link',
  '20260921235500_add_zetta_product_link',
  '20260922170000_add_cliente_cpf_cnpj',
  '20260922183000_add_venda_siggma_import_state',
  '20260923120000_client_invitations',
  '20260925000000_mercado_livre_connection',
  '20260928010000_customer_experience',
]

const requiredTables = [
  'Cupom',
  'CupomUso',
  'ClientInvitation',
  'MercadoLivreConnection',
  'CustomerPreference',
  'CustomerPetProfile',
  'ProductReview',
  'BookingRequest',
  'LoyaltyConfig',
  'LoyaltyRedemption',
]

const requiredColumns = [
  ['Venda', 'subtotalProdutos'],
  ['Venda', 'cupomId'],
  ['User', 'siggmaCliCod'],
  ['Produto', 'zettaProCod'],
  ['Cliente', 'cpfCnpj'],
  ['Venda', 'siggmaGuid'],
  ['Venda', 'siggmaImportStatus'],
]

function runPrisma(args) {
  const result = spawnSync('bunx', ['prisma', ...args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1',
    },
  })

  if (result.status !== 0) {
    throw new Error(`Falha ao executar: bunx prisma ${args.join(' ')}`)
  }
}

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('"public"."${table}"')::text AS name`
  )
  return Boolean(rows?.[0]?.name)
}

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1`,
    table,
    column
  )
  return rows.length > 0
}

async function migrationHistory() {
  const exists = await tableExists('_prisma_migrations')
  if (!exists) return []

  const rows = await prisma.$queryRawUnsafe(
    'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL'
  )
  return rows.map((row) => String(row.migration_name))
}

async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log(`Baseline ignorado (VERCEL_ENV=${process.env.VERCEL_ENV || 'undefined'})`)
    return
  }

  const applied = new Set(await migrationHistory())
  const missingBaseline = baselineMigrations.filter((name) => !applied.has(name))

  if (missingBaseline.length === 0) {
    console.log('Baseline Prisma já está registrado.')
    return
  }

  const missingArtifacts = []

  for (const table of requiredTables) {
    if (!(await tableExists(table))) missingArtifacts.push(`tabela ${table}`)
  }

  for (const [table, column] of requiredColumns) {
    if (!(await columnExists(table, column))) {
      missingArtifacts.push(`coluna ${table}.${column}`)
    }
  }

  if (missingArtifacts.length > 0) {
    throw new Error(
      'Não é seguro criar o baseline automaticamente. Estruturas antigas ausentes: ' +
        missingArtifacts.join(', ')
    )
  }

  console.log(
    `Criando baseline Prisma para ${missingBaseline.length} migration(s) já refletidas no banco...`
  )

  for (const migration of missingBaseline) {
    console.log(`Marcando como aplicada: ${migration}`)
    runPrisma([
      'migrate',
      'resolve',
      '--applied',
      migration,
      '--schema=prisma/schema.prisma',
    ])
  }

  console.log('Baseline Prisma concluído.')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
