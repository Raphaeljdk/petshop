import { z } from 'zod'

// Separar o formulário dos metadados do Prisma (id, createdAt, updatedAt).
// A API de produção mantém a validação estrita; o cliente envia só os campos editáveis.
export const configSchema = z.object({
  razaoSocial: z.string().max(180).nullable().optional(),
  nomeFantasia: z.string().max(180).nullable().optional(),
  cnpj: z.string().max(18).nullable().optional(),
  inscricaoEstadual: z.string().max(25).nullable().optional(),
  regimeTributario: z.enum(['1','2','3']).nullable().optional(),
  logradouro: z.string().max(180).nullable().optional(),
  numeroEndereco: z.string().max(15).nullable().optional(),
  bairro: z.string().max(90).nullable().optional(),
  cidade: z.string().max(90).nullable().optional(),
  uf: z.string().max(2).nullable().optional(),
  cep: z.string().max(9).nullable().optional(),
  codigoMunicipio: z.string().max(7).nullable().optional(),
  serieNfe: z.number().int().min(1).max(999),
  ambiente: z.enum(['homologacao','producao']),
}).strict()

export type FormEmitente = z.input<typeof configSchema>

export function camposEditaveisEmitente(v: Omit<FormEmitente, 'regimeTributario'> & {regimeTributario?: string|null}) {
  return {
    razaoSocial: v.razaoSocial ?? null,
    nomeFantasia: v.nomeFantasia ?? null,
    cnpj: v.cnpj ?? null,
    inscricaoEstadual: v.inscricaoEstadual ?? null,
    regimeTributario: v.regimeTributario || null,
    logradouro: v.logradouro ?? null,
    numeroEndereco: v.numeroEndereco ?? null,
    bairro: v.bairro ?? null,
    cidade: v.cidade ?? null,
    uf: v.uf ?? null,
    cep: v.cep ?? null,
    codigoMunicipio: v.codigoMunicipio ?? null,
    serieNfe: v.serieNfe,
    ambiente: v.ambiente,
  }
}

export function erroConfigEmitente(error: z.ZodError): string {
  const fieldNames: Record<string,string> = {
    razaoSocial: 'Razão social', nomeFantasia: 'Nome fantasia', cnpj: 'CNPJ',
    inscricaoEstadual: 'Inscrição estadual', regimeTributario: 'Regime tributário',
    logradouro: 'Logradouro', numeroEndereco: 'Número do endereço', bairro: 'Bairro',
    cidade: 'Cidade', uf: 'UF', cep: 'CEP', codigoMunicipio: 'Código IBGE do município',
    serieNfe: 'Série de NF-e', ambiente: 'Ambiente',
  }
  const problem=error.issues[0]
  if(!problem)return 'Confira os dados fiscais e tente novamente.'
  if(problem.code==='unrecognized_keys')return 'A tela enviou campos internos não editáveis. Atualize o painel e tente salvar novamente.'
  const name=fieldNames[String(problem.path[0])]||'Cadastro fiscal'
  return name+': '+problem.message
}
