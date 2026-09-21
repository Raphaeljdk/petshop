/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('node:crypto')
const express = require('express')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const dotenv = require('dotenv')
const { Pool } = require('pg')

dotenv.config({ path: process.env.ENV_FILE || '/opt/matilha-integration/.env' })

const app = express()
app.set('trust proxy', 1)
const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || '127.0.0.1'

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '256kb' }))
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

function env(name) {
  return String(process.env[name] || '').trim()
}

function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a || '')).digest()
  const right = crypto.createHash('sha256').update(String(b || '')).digest()
  return crypto.timingSafeEqual(left, right)
}

function requireBridgeAuth(req, res, next) {
  const expected = env('BRIDGE_API_SECRET')
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''

  if (!expected || !token || !safeEqual(token, expected)) {
    return res.status(401).json({ ok: false, error: 'Não autorizado' })
  }

  next()
}

function dbConfigStatus() {
  const required = [
    'SIGGMA_DB_HOST',
    'SIGGMA_DB_PORT',
    'SIGGMA_DB_NAME',
    'SIGGMA_DB_USER',
    'SIGGMA_DB_PASSWORD',
  ]
  const missing = required.filter((name) => !env(name))
  return { configured: missing.length === 0, missing }
}

function siggmaConfigStatus() {
  const required = [
    'SIGGMA_BASE_URL',
    'SIGGMA_CLIENT_ID',
    'SIGGMA_CLIENT_SECRET',
    'SIGGMA_EMP',
  ]
  const missing = required.filter((name) => !env(name))
  return { configured: missing.length === 0, missing }
}

let pool

function getPool() {
  const status = dbConfigStatus()
  if (!status.configured) {
    const error = new Error(`Configuração PostgreSQL incompleta: ${status.missing.join(', ')}`)
    error.statusCode = 503
    throw error
  }

  if (!pool) {
    pool = new Pool({
      host: env('SIGGMA_DB_HOST'),
      port: Number(env('SIGGMA_DB_PORT') || 5734),
      database: env('SIGGMA_DB_NAME'),
      user: env('SIGGMA_DB_USER'),
      password: env('SIGGMA_DB_PASSWORD'),
      ssl: env('SIGGMA_DB_SSLMODE').toLowerCase() === 'require'
        ? { rejectUnauthorized: false }
        : false,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      application_name: 'matilha-integration-readonly',
      options: '-c default_transaction_read_only=on -c statement_timeout=10000',
    })
  }

  return pool
}

function parsePositiveInt(value, fallback, max = 100) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function pagination(req) {
  const page = parsePositiveInt(req.query.page || req.query.pagina, 1, 1_000_000)
  const limit = parsePositiveInt(req.query.limit, 50, 100)
  return { page, limit, offset: (page - 1) * limit }
}

function addFilter(filters, values, sql, value) {
  values.push(value)
  filters.push(sql.replaceAll('?', `${values.length}`))
}

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('[bridge]', error)
      const status = Number(error?.statusCode || 500)
      res.status(status).json({
        ok: false,
        error: status >= 500 ? 'Falha ao consultar integração' : String(error.message || 'Erro'),
      })
    }
  }
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'matilha-integration',
    status: 'online',
    hostname: require('node:os').hostname(),
    now: new Date().toISOString(),
  })
})

app.use('/api', requireBridgeAuth)

app.get('/api/status', (_req, res) => {
  const siggma = siggmaConfigStatus()
  const zetta = dbConfigStatus()

  res.json({
    ok: true,
    bridge: 'online',
    siggmaApiConfigured: siggma.configured,
    zettaDatabaseConfigured: zetta.configured,
  })
})

app.get(
  '/api/siggma/status',
  asyncRoute(async (_req, res) => {
    const status = siggmaConfigStatus()
    if (!status.configured) {
      return res.status(503).json({
        ok: false,
        configured: false,
        missing: status.missing,
        authenticated: false,
      })
    }

    const baseUrl = env('SIGGMA_BASE_URL').replace(/\/+$/, '')
    const body = new URLSearchParams({
      grant_type: 'client_credentials_emp',
      client_id: env('SIGGMA_CLIENT_ID'),
      client_secret: env('SIGGMA_CLIENT_SECRET'),
      emp: env('SIGGMA_EMP'),
    })

    const response = await fetch(`${baseUrl}/v2/oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })

    const payload = await response.json().catch(() => null)
    const authenticated = Boolean(
      response.ok &&
      payload &&
      typeof payload === 'object' &&
      payload.access_token
    )

    res.status(authenticated ? 200 : 502).json({
      ok: authenticated,
      configured: true,
      authenticated,
      status: response.status,
    })
  })
)

app.get(
  '/api/zetta/status',
  asyncRoute(async (_req, res) => {
    const db = getPool()
    const result = await db.query(
      `SELECT
        current_database() AS database,
        current_user AS "user",
        (SELECT COUNT(*)::int FROM "CLIENTES") AS clientes,
        (SELECT COUNT(*)::int FROM animais) AS animais,
        (SELECT COUNT(*)::int FROM "PRODUTOS") AS produtos,
        (SELECT COUNT(*)::int FROM "ESTOQUE") AS estoque,
        (SELECT COUNT(*)::int FROM petshop_atendimentos) AS atendimentos`
    )

    res.json({
      ok: true,
      configured: true,
      connected: true,
      ...result.rows[0],
    })
  })
)

app.get(
  '/api/zetta/clientes',
  asyncRoute(async (req, res) => {
    const db = getPool()
    const { page, limit, offset } = pagination(req)
    const filters = []
    const values = []

    const q = String(req.query.q || '').trim()
    const since = parseDate(req.query.since)

    if (q) {
      addFilter(
        filters,
        values,
        `(p.nome ILIKE ? OR p.email ILIKE ? OR p.telefone ILIKE ? OR p.celular ILIKE ?)`,
        `%${q}%`
      )
    }

    if (since) {
      addFilter(
        filters,
        values,
        `GREATEST(
          COALESCE(c.data_atualizacao, TIMESTAMP 'epoch'),
          COALESCE(p.data_atualizacao, TIMESTAMP 'epoch')
        ) >= ?`,
        since
      )
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM "CLIENTES" c
      JOIN pessoas p ON p.id = c.pessoa
      ${where}
    `
    const count = await db.query(countSql, values)

    const dataValues = [...values, limit, offset]
    const limitParam = `$${dataValues.length - 1}`
    const offsetParam = `$${dataValues.length}`

    const data = await db.query(
      `
      SELECT
        c.cli_cod AS id,
        p.nome,
        p.apelido_fantasia AS apelido,
        p.email,
        p.telefone,
        p.celular,
        c.data_atualizacao AS "dataAtualizacao",
        (c.data_desativacao IS NULL) AS ativo
      FROM "CLIENTES" c
      JOIN pessoas p ON p.id = c.pessoa
      ${where}
      ORDER BY c.cli_cod
      LIMIT ${limitParam} OFFSET ${offsetParam}
      `,
      dataValues
    )

    res.json({
      ok: true,
      page,
      limit,
      total: count.rows[0].total,
      data: data.rows,
    })
  })
)

app.get(
  '/api/zetta/clientes/:id',
  asyncRoute(async (req, res) => {
    const id = Number.parseInt(String(req.params.id || ''), 10)
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ ok: false, error: 'Cliente inválido' })
    }

    const db = getPool()
    const result = await db.query(
      `
      SELECT
        c.cli_cod AS id,
        p.nome,
        p.apelido_fantasia AS apelido,
        p.email,
        p.telefone,
        p.celular,
        c.data_atualizacao AS "dataAtualizacao",
        (c.data_desativacao IS NULL) AS ativo
      FROM "CLIENTES" c
      JOIN pessoas p ON p.id = c.pessoa
      WHERE c.cli_cod = $1
      LIMIT 1
      `,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Cliente não encontrado' })
    }

    res.json({ ok: true, data: result.rows[0] })
  })
)

app.get(
  '/api/zetta/animais',
  asyncRoute(async (req, res) => {
    const db = getPool()
    const { page, limit, offset } = pagination(req)
    const filters = []
    const values = []

    const cliente = Number.parseInt(String(req.query.cliente || ''), 10)
    const q = String(req.query.q || '').trim()
    const since = parseDate(req.query.since)

    if (Number.isFinite(cliente) && cliente > 0) {
      addFilter(filters, values, 'a.cliente = ?', cliente)
    }
    if (q) {
      addFilter(filters, values, 'a.nome ILIKE ?', `%${q}%`)
    }
    if (since) {
      addFilter(filters, values, 'a.data_atualizacao >= ?', since)
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const count = await db.query(
      `SELECT COUNT(*)::int AS total FROM animais a ${where}`,
      values
    )

    const dataValues = [...values, limit, offset]
    const data = await db.query(
      `
      SELECT
        a.id,
        a.cliente AS "clienteId",
        a.nome,
        a.data_nascimento AS "dataNascimento",
        a.microchip,
        a.sexo,
        a.peso,
        a.porte,
        a.especie,
        a.raca,
        a.status,
        a.pelagem,
        a.castrado,
        a.comportamento,
        a.filial,
        a.data_atualizacao AS "dataAtualizacao"
      FROM animais a
      ${where}
      ORDER BY a.id
      LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}
      `,
      dataValues
    )

    res.json({
      ok: true,
      page,
      limit,
      total: count.rows[0].total,
      data: data.rows,
    })
  })
)

app.get(
  '/api/zetta/historicos',
  asyncRoute(async (req, res) => {
    const db = getPool()
    const { page, limit, offset } = pagination(req)
    const filters = []
    const values = []

    const cliente = Number.parseInt(String(req.query.cliente || ''), 10)
    const animal = Number.parseInt(String(req.query.animal || ''), 10)
    const since = parseDate(req.query.since)

    if (Number.isFinite(cliente) && cliente > 0) {
      addFilter(filters, values, 'a.cliente = ?', cliente)
    }
    if (Number.isFinite(animal) && animal > 0) {
      addFilter(filters, values, 'h.animal = ?', animal)
    }
    if (since) {
      addFilter(
        filters,
        values,
        `GREATEST(
          COALESCE(h.data_atualizacao, TIMESTAMP 'epoch'),
          COALESCE(h.datahora, TIMESTAMP 'epoch')
        ) >= ?`,
        since
      )
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const count = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM animais_historicos h
      JOIN animais a ON a.id = h.animal
      ${where}
      `,
      values
    )

    const dataValues = [...values, limit, offset]
    const data = await db.query(
      `
      SELECT
        h.id,
        h.animal AS "animalId",
        a.cliente AS "clienteId",
        a.nome AS "animalNome",
        a.especie,
        a.raca,
        h.datahora,
        h.tipo,
        h.status,
        h.peso,
        h.evento,
        h.descricao,
        h.tipo_servico AS "tipoServico",
        h.data_atualizacao AS "dataAtualizacao",
        h.filial,
        h.excluido,
        h.entregue,
        h.data_entregue AS "dataEntregue",
        h.observacoes,
        h.quadro_clinico AS "quadroClinico"
      FROM animais_historicos h
      JOIN animais a ON a.id = h.animal
      ${where}
      ORDER BY h.datahora DESC NULLS LAST, h.id DESC
      LIMIT ${dataValues.length - 1} OFFSET ${dataValues.length}
      `,
      dataValues
    )

    res.json({
      ok: true,
      page,
      limit,
      total: count.rows[0].total,
      data: data.rows,
    })
  })
)

app.get(
  '/api/zetta/produtos',
  asyncRoute(async (req, res) => {
    const db = getPool()
    const { page, limit, offset } = pagination(req)
    const filters = ['COALESCE(p.excluido, false) = false']
    const values = []

    const q = String(req.query.q || '').trim()
    const since = parseDate(req.query.since)

    if (q) {
      addFilter(
        filters,
        values,
        `(
          p.pro_nom ILIKE ?
          OR p.pro_cod_ori ILIKE ?
          OR p.codigo_barras ILIKE ?
          OR p.gtin ILIKE ?
        )`,
        `%${q}%`
      )
    }
    if (since) {
      addFilter(filters, values, 'p.data_atualizacao >= ?', since)
    }

    const where = `WHERE ${filters.join(' AND ')}`
    const count = await db.query(
      `SELECT COUNT(*)::int AS total FROM "PRODUTOS" p ${where}`,
      values
    )

    const dataValues = [...values, limit, offset]
    const data = await db.query(
      `
      SELECT
        p.pro_cod AS id,
        p.pro_cod_ori AS codigo,
        p.pro_nom AS nome,
        p.pro_val_ven AS preco,
        p.pro_car_mar AS marca,
        p.pro_car_mod AS modelo,
        p.med_abr AS unidade,
        p.codigo_barras AS "codigoBarras",
        p.gtin,
        p.estoque_real AS "estoqueRealProduto",
        COALESCE(e.estoque_total, 0) AS "estoqueReal",
        p.galeria,
        p.data_atualizacao AS "dataAtualizacao"
      FROM "PRODUTOS" p
      LEFT JOIN (
        SELECT
          pro_cod,
          SUM(COALESCE(estoque_real, est_qtd, 0)) AS estoque_total
        FROM "ESTOQUE"
        GROUP BY pro_cod
      ) e ON e.pro_cod = p.pro_cod
      ${where}
      ORDER BY p.pro_cod
      LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}
      `,
      dataValues
    )

    res.json({
      ok: true,
      page,
      limit,
      total: count.rows[0].total,
      data: data.rows,
    })
  })
)

app.get(
  '/api/zetta/atendimentos',
  asyncRoute(async (req, res) => {
    const db = getPool()
    const { page, limit, offset } = pagination(req)
    const filters = []
    const values = []

    const cliente = Number.parseInt(String(req.query.cliente || ''), 10)
    const animal = Number.parseInt(String(req.query.animal || ''), 10)
    const since = parseDate(req.query.since)

    if (Number.isFinite(cliente) && cliente > 0) {
      addFilter(filters, values, 'pa.cliente = ?', cliente)
    }
    if (Number.isFinite(animal) && animal > 0) {
      addFilter(
        filters,
        values,
        `EXISTS (
          SELECT 1
          FROM petshop_atendimentos_itens pai
          JOIN animais_historicos ah ON ah.id = pai.historico
          WHERE pai.atendimento = pa.id
            AND ah.animal = ?
        )`,
        animal
      )
    }
    if (since) {
      addFilter(filters, values, 'pa.datahora >= ?', since)
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const count = await db.query(
      `SELECT COUNT(*)::int AS total FROM petshop_atendimentos pa ${where}`,
      values
    )

    const dataValues = [...values, limit, offset]
    const data = await db.query(
      `
      SELECT
        pa.id,
        pa.cliente AS "clienteId",
        pa.datahora,
        pa.status,
        pa.total,
        pa.filial,
        pa.total_itens AS "totalItens"
      FROM petshop_atendimentos pa
      ${where}
      ORDER BY pa.datahora DESC, pa.id DESC
      LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}
      `,
      dataValues
    )

    res.json({
      ok: true,
      page,
      limit,
      total: count.rows[0].total,
      data: data.rows,
    })
  })
)

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Rota não encontrada' })
})

const server = app.listen(PORT, HOST, () => {
  console.log(`Matilha Integration online em http://${HOST}:${PORT}`)
})

async function shutdown(signal) {
  console.log(`Encerrando bridge (${signal})...`)
  server.close(async () => {
    if (pool) {
      try {
        await pool.end()
      } catch (error) {
        console.error('Erro ao fechar pool PostgreSQL:', error)
      }
    }
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
