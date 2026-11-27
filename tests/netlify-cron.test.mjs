import { test, expect } from 'bun:test'
import { executarCron } from '../netlify/lib/cron.mjs'
const env={MATILHA_DEPLOY_STAGE:'production',MATILHA_NETLIFY_CRONS_ENABLED:'true',CRON_SECRET:'teste',URL:'https://example.test'}
test('cron desativado por padrão e em previews',async()=>{
 const fail=async()=>{throw Error('não deve chamar')}
 expect((await executarCron('/api/cron/nfe-email',{},fail)).body).toBe('disabled')
 expect((await executarCron('/api/cron/nfe-email',{...env,MATILHA_DEPLOY_STAGE:'deploy-preview'},fail)).body).toBe('disabled')
 expect((await executarCron('/api/cron/nfe-email',{...env,MATILHA_NETLIFY_CRONS_ENABLED:'false'},fail)).body).toBe('disabled')
})
test('cron autentica a rota e não segue redirecionamento',async()=>{
 let chamadas=0
 const request=async(url,opts)=>{
  chamadas++
  expect(url.toString()).toBe('https://example.test/api/cron/nfe-email')
  expect(opts.headers.authorization).toBe('Bearer teste')
  expect(opts.redirect).toBe('error')
  return {ok:true}
 }
 expect((await executarCron('/api/cron/nfe-email',env,request)).statusCode).toBe(200)
 expect(chamadas).toBe(1)
 expect((await executarCron('/api/cron/nfe-email',{...env,CRON_SECRET:''},request)).statusCode).toBe(503)
 expect(chamadas).toBe(1)
 expect((await executarCron('/api/cron/nfe-email',env,async()=>({ok:false}))).statusCode).toBe(502)
})
