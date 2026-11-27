// Never run jobs on branch previews; production must be explicitly enabled.
// URL is fixed to the site provisioned by Netlify, not supplied by a request.
export async function executarCron(path, env=process.env, request=fetch) {
 if(env.MATILHA_DEPLOY_STAGE!=='production'||env.MATILHA_NETLIFY_CRONS_ENABLED!=='true')return {statusCode:200,body:'disabled'}
 const secret=env.CRON_SECRET?.trim()
 if(!secret||!env.URL)return {statusCode:503,body:'configuration required'}
 const base=new URL(env.URL)
 if(base.protocol!=='https:'||base.username||base.password)return {statusCode:503,body:'invalid origin'}
 try {
  const response=await request(new URL(path,base.origin),{
   headers:{authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(24000),
  })
  return {statusCode:response.ok?200:502,body:response.ok?'ok':'job failed'}
 } catch {return {statusCode:502,body:'job unavailable'}}
}
