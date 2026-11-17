/** Perguntas oficiais das fichas Matilha Prado, versão 1. NUNCA inferir avaliação clínica. */
export const ACEITE_VERSAO='matilha-anamnese-2026-11-v1'
export const CHECKOUT_ACEITE_VERSAO='matilha-checkout-2026-11-v1'
export const CHECKOUT_ACEITE_TEXTO='Declaro que tive acesso à ficha de check-out do meu pet e li as informações registradas pela equipe sobre os procedimentos realizados e as condições de saída. Ao confirmar, registro minha ciência sobre o conteúdo apresentado, sem renunciar a direitos ou substituir avaliação veterinária. Caso identifique divergências, posso registrar discordância para análise da equipe.'
export const ACEITE_TEXTO='Declaro que as informações fornecidas sobre a saúde e o comportamento do meu pet são verdadeiras e que fui informado(a) sobre as condições visíveis identificadas no momento do check-in. Estou ciente de que a avaliação da equipe da Matilha Prado é exclusivamente visual e preventiva, não substitui avaliação veterinária ou diagnóstico clínico. Autorizo o serviço contratado respeitando as condições observadas e os limites necessários para preservar o bem-estar e a segurança do pet.'

export type FormField={id:string;label:string;kind:'choice'|'multi'|'text';options?:readonly string[]}
export type FormSection={id:string;title:string;description?:string;fields:FormField[]}
export type FormAnswers=Record<string,string|string[]>
const choice=(id:string,label:string,options:readonly string[]):FormField=>({id,label,kind:'choice',options})
const multi=(id:string,label:string,options:readonly string[]):FormField=>({id,label,kind:'multi',options})
const text=(id:string,label:string):FormField=>({id,label,kind:'text'})
const yes=['Não','Sim','Não informado'] as const
const three=['Normal','Alterado','Não avaliado'] as const
const two=['Normal','Alterado','Não avaliado'] as const
const result=['Sem alterações','Com alterações','Não avaliado'] as const
const adequate=['Adequado','Necessita atenção','Não avaliado'] as const
const done=['Realizado','Não realizado','Não aplicável'] as const
const condition=(prefix:string,names:readonly string[],options:readonly string[]=three)=>names.map((label,i)=>choice(prefix+(i+1),label,options))
export const CHECKIN_SECTIONS:FormSection[]=[
 {id:'saude',title:'2. Histórico de saúde',fields:[
 choice('saude1','Possui algum problema de saúde conhecido?',yes),text('saude1det','Qual?'),
 choice('saude2','Faz uso de medicamentos contínuos?',yes),text('saude2det','Quais?'),
 choice('saude3','Possui alergias conhecidas?',yes),text('saude3det','Quais?'),
 choice('saude4','Possui histórico de problemas dermatológicos?',yes),text('saude4det','Quais?'),
 choice('saude5','Já apresentou otite ou outros problemas de ouvido?',yes),
 choice('saude6','Apresenta sensibilidade em alguma região do corpo?',yes),text('saude6det','Onde?'),
 choice('saude7','Possui restrição para banho, secagem ou produtos?',yes),text('saude7det','Qual?'),
 choice('saude8','Vacinação e controle de pulgas/carrapatos em dia?',['Sim','Não','Não informado']),
 choice('saude9','Alteração de saúde ou comportamento nos últimos dias?',yes),text('saude9det','Descrever'),
 choice('saude10','Medo, ansiedade, desconforto ou reatividade no banho/tosa?',yes),text('saude10det','Descrever'),
 ]},
 {id:'pele',title:'3. Avaliação da pele',description:'Inspeção visual e tátil superficial, sem diagnóstico veterinário.',fields:[
 ...condition('pele',['Coloração da pele','Vermelhidão','Ressecamento','Oleosidade excessiva','Descamação/caspa','Feridas ou escoriações','Caroços ou elevações','Irritações ou manchas','Presença de pulgas','Presença de carrapatos']),
 choice('peleCoceira','Coceira frequente?',yes),
 multi('peleRegioes','Regiões com alterações',['Dorso','Barriga','Axilas','Virilha','Patas','Pescoço','Região lombar','Outra']),
 text('peleOutraRegiao','Outra região'),text('peleObs','Observações'),
 ]},
 {id:'pelagem',title:'4. Avaliação da pelagem',fields:[
 ...condition('pelagem',['Brilho e aspecto dos pelos','Maciez e textura','Presença de nós','Subpelo acumulado','Queda excessiva de pelos','Pelagem ressecada','Pelagem excessivamente oleosa','Sujeira ou resíduos','Odor anormal'],two),
 choice('pelagemCondicao','Condição da pelagem',['Excelente','Boa','Regular','Necessita de atenção','Não avaliado']),
 choice('pelagemNos','Grau de embaraçamento',['Sem nós','Nós leves','Nós moderados','Nós intensos','Pelagem compactada / placas de nós','Não avaliado']),
 multi('pelagemRegioes','Regiões com nós ou compactação',['Atrás das orelhas','Axilas','Barriga','Virilha','Patas','Cauda','Corpo todo']),
 text('pelagemObs','Observações'),
 ]},
 {id:'ouvidos',title:'5. Avaliação dos ouvidos',fields:[
 ...condition('ouvido',['Coloração externa','Presença de secreção','Excesso de cerúmen','Odor desagradável','Vermelhidão','Sensibilidade ao toque','Coceira ou desconforto'],two),
 text('ouvidoObs','Observações'),
 ]},
 {id:'olhos',title:'6. Avaliação dos olhos',fields:[
 ...condition('olho',['Aparência geral dos olhos','Vermelhidão','Lacrimejamento excessivo','Presença de secreção','Manchas ou resíduos','Inchaço na região','Sensibilidade ou incômodo'],two),
 text('olhoObs','Observações'),
 ]},
 {id:'patas',title:'7. Unhas e patas',fields:[
 ...condition('pata',['Comprimento das unhas','Unhas quebradas ou rachadas','Unhas encravadas','Vermelhidão entre os dedos','Feridas nas patas','Almofadinhas ressecadas','Nós entre os dedos','Sensibilidade ao toque'],two),
 choice('pataCorte','Necessidade de corte de unhas',['Não','Sim','Avaliar com o tutor']),
 text('pataObs','Observações'),
 ]},
 {id:'chegada',title:'8. Avaliação geral no check-in',fields:[
 multi('chegadaComportamento','Comportamento na chegada',['Tranquilo','Agitado','Medroso','Ansioso','Reativo','Desconforto ao toque']),
 choice('chegadaCondicao','Condição geral observada',['Sem alterações visíveis','Apresenta alterações que precisam de atenção','Necessita avaliação veterinária antes do procedimento']),
 choice('chegadaComunicar','Condição precisa ser comunicada antes do serviço?',yes),
 text('chegadaDescricao','Descrição'),
 ]},
 {id:'comunicacao',title:'9. Registro e comunicação com tutor',fields:[
 multi('checkinComunicacoes','Ações e comunicações realizadas',['Tutor informado das condições','Alterações registradas fotograficamente','Cuidados específicos comunicados','Serviço ajustado às condições do pet','Procedimento suspenso/não iniciado por segurança']),
 text('checkinOrientacoes','Observações e orientações combinadas'),
 ]},
 {id:'equipeEntrada',title:'11. Registro interno — entrada',fields:[
 text('entradaResponsavel','Responsável pelo check-in'),
 text('entradaInicio','Horário de início (se realizado)'),
 multi('entradaMarcadores','Registros da equipe',['Check-in realizado','Fotografias de entrada registradas','Tutor comunicado sobre alterações']),
 text('entradaObs','Observações da equipe'),
 ]},
]
export const CHECKOUT_SECTIONS:FormSection[]=[
 {id:'servico',title:'1. Identificação e serviço',fields:[
 text('saidaResponsavel','Responsável pelo banho/tosa'),
 multi('saidaServicos','Serviço realizado',['Banho','Banho + tosa','Tosa','Hidratação','Outros']),
 text('saidaOutroServico','Outros serviços'),
 ]},
 {id:'secagem',title:'2. Avaliação da secagem e acabamento',fields:[
 ...condition('seca',['Região do dorso','Barriga','Axilas','Virilha','Patas e entre os dedos','Atrás das orelhas','Pescoço','Cauda','Ausência de umidade próxima à pele'],adequate),
 choice('secaCondicao','Condição final da pelagem',['Totalmente seca','Necessita secagem complementar','Apresenta pontos de umidade']),
 multi('secaAcabamento','Acabamento',['Pelagem escovada e alinhada','Nós removidos conforme segurança','Subpelo removido conforme necessidade','Pelagem finalizada e com bom aspecto']),
 text('secaObs','Observações'),
 ]},
 {id:'pele',title:'3. Pele e possíveis irritações',fields:[
 ...condition('saidaPele',['Vermelhidão na pele','Irritação após escovação','Irritação após tosa','Sensibilidade ao toque','Escoriações aparentes','Ressecamento','Reação aparente a produtos','Coceira/desconforto'],result),
 multi('saidaPeleRegioes','Regiões que merecem atenção',['Pescoço','Dorso','Barriga','Axilas','Virilha','Patas','Região íntima','Região da tosa','Outra']),
 text('saidaPeleOutra','Outra região'),
 choice('saidaPeleAlteracao','Alteração durante ou após o procedimento?',yes),
 text('saidaPeleProvidencias','Descrição e providências adotadas'),
 ]},
 {id:'ouvidos',title:'4. Limpeza dos ouvidos',fields:[
 ...condition('saidaOuvido',['Higienização externa','Remoção de resíduos visíveis','Conferência visual após higienização'],done),
 multi('saidaOuvidoCondicao','Condição após limpeza',['Sem alterações aparentes','Vermelhidão','Excesso de cerúmen','Odor desagradável','Secreção','Sensibilidade/desconforto']),
 text('saidaOuvidoObs','Observações'),
 ]},
 {id:'olhos',title:'5. Limpeza dos olhos',fields:[
 ...condition('saidaOlho',['Limpeza ao redor dos olhos','Remoção de secreções externas','Remoção de resíduos acumulados','Conferência visual após limpeza'],done),
 multi('saidaOlhoCondicao','Condição após limpeza',['Sem alterações aparentes','Lacrimejamento excessivo','Secreção persistente','Vermelhidão','Irritação aparente','Sensibilidade/desconforto']),
 text('saidaOlhoObs','Observações'),
 ]},
 {id:'unhas',title:'6. Corte de unhas e acabamento das patas',fields:[
 choice('saidaUnhasCorte','Corte de unhas',['Realizado','Não realizado','Não necessário','Não realizado por segurança/desconforto']),
 multi('saidaUnhasConferencia','Conferência final',['Comprimento adequado','Unhas conferidas individualmente','Sem sangramento aparente','Patas higienizadas','Pelos entre almofadinhas aparados quando indicado','Região entre dedos conferida']),
 multi('saidaUnhasAlteracao','Alterações',['Nenhuma','Unha quebrada','Unha com fissura','Sensibilidade','Ferimento','Outra']),
 text('saidaUnhasObs','Observações'),
 ]},
 {id:'final',title:'7. Conferência final do pet',fields:[
 multi('saidaChecklist','Antes de liberar o pet',['Pelagem completamente seca','Ausência de resíduos de produtos','Pele conferida após o procedimento','Ouvidos higienizados externamente','Região dos olhos limpa','Unhas conferidas quando contratadas','Patas higienizadas','Acessório colocado quando aplicável','Pet confortável e acomodado']),
 multi('saidaCondicao','Condição geral na saída',['Tranquilo','Alegre e receptivo','Cansado','Agitado','Desconforto durante o procedimento']),
 ]},
 {id:'tutor',title:'8. Comunicação com o tutor',fields:[
 multi('saidaComunicacoes','Informações comunicadas',['Tutor informado sobre cuidados realizados','Tutor informado sobre alterações','Fotografias e vídeos registrados','Recomendações de manutenção da pelagem','Necessidade de avaliação veterinária comunicada quando aplicável']),
 text('saidaOrientacoes','Orientações e recomendações'),
 ]},
 {id:'responsabilidade',title:'9. Finalização e responsabilidade',fields:[
 text('saidaHorario','Horário de término'),text('saidaFinalizador','Responsável pela finalização'),
 text('saidaConferente','Responsável pela conferência'),
 text('saidaAssinatura','Nome do responsável (registro interno)'),
 text('saidaObs','Observações finais'),
 ]},
]
export const ALL_FIELDS={checkin:CHECKIN_SECTIONS.flatMap(s=>s.fields),checkout:CHECKOUT_SECTIONS.flatMap(s=>s.fields)}
export function answerCount(answers:FormAnswers){return Object.values(answers).filter(v=>Array.isArray(v)?v.length>0:v.trim().length>0).length}
export function sanitizeFormAnswers(kind:'checkin'|'checkout',source:unknown):FormAnswers {
  if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Ficha inválida.')
  const raw=source as Record<string,unknown>
  const fields=ALL_FIELDS[kind]
  const valid=new Map(fields.map(f=>[f.id,f]))
  if(Object.keys(raw).length>fields.length)throw Error('Ficha contém campos não reconhecidos.')
  const result:FormAnswers={}
  for(const [id,v] of Object.entries(raw)){
    const f=valid.get(id)
    if(!f)throw Error('Campo não permitido: '+id)
    if(f.kind==='multi'){
      if(!Array.isArray(v)||v.length>f.options!.length||v.some(x=>typeof x!=='string'||!f.options!.includes(x)))throw Error('Valor inválido: '+id)
      result[id]=[...new Set(v)]
    }else{
      if(typeof v!=='string'||v.length>(f.kind==='text'?1500:150)||f.kind==='choice'&&!f.options!.includes(v))throw Error('Valor inválido: '+id)
      result[id]=v.trim()
    }
  }
  return result
}
