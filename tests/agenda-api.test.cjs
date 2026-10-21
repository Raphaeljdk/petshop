const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const erp=fs.existsSync(path.join(root,'src/lib/http.ts'));
function fixture(){
 const ctx={session:null,record:null,writes:0,events:0,queries:[],race:false};
 const model={
  findFirst:async({where})=>{ctx.queries.push(where);if(where.id?.not)return null;return ctx.record && (!where.tenantId||where.tenantId===ctx.record.tenantId)?ctx.record:null},
  findUnique:async()=>ctx.record,
  findUniqueOrThrow:async()=>ctx.record,
  findMany:async({where})=>{ctx.queries.push(where);return ctx.record && (!where.tenantId||where.tenantId===ctx.record.tenantId)?[ctx.record]:[]},
  count:async()=>ctx.record?1:0,
  updateMany:async({where,data})=>{ctx.queries.push(where);if(ctx.race)return {count:0};ctx.record={...ctx.record,...data};ctx.writes++;return {count:1}},
 };
 const db={appointment:model,agendamento:model,pet:{findFirst:async()=>({id:'pet'})},agendaEvento:{create:async()=>{ctx.events++;return {}}}};
 db.$transaction=async fn=>fn(db);
 const cache=new Map();
 const stubs={
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '@prisma/client':{Prisma:{PrismaClientKnownRequestError:class extends Error{}}},
  '@/lib/db':{db},'@/lib/prisma':{prisma:db},
  '@/lib/auth-cookies':{getUsuarioLogado:async()=>ctx.session,assertAuthConfigured(){}},
  '@/lib/auth':{getSession:async()=>ctx.session},
 };
 function load(file){
  if(cache.has(file))return cache.get(file).exports;
  const mod={exports:{}};cache.set(file,mod);
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  function localRequire(name){
   const alias=name.startsWith('.')?'@/'+path.relative(path.join(root,'src'),path.resolve(path.dirname(file),name)).replaceAll('\\','/'):name;
   if(stubs[alias])return stubs[alias];
   if(alias.startsWith('@/'))return load(path.join(root,'src',alias.slice(2)+'.ts'));
   return require(name);
  }
  vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(localRequire,mod,mod.exports);
  return mod.exports;
 }
 const base=erp?'appointments':'agendamentos';
 ctx.get=load(path.join(root,`src/app/api/${base}/route.ts`)).GET;
 ctx.patch=load(path.join(root,`src/app/api/${base}/[id]/route.ts`)).PATCH;
 ctx.req=(body={},origin='https://example.test')=>{const url=new URL(`https://example.test/api/${base}?inicio=2026-10-01T00:00:00Z&fim=2026-11-01T00:00:00Z`);return {url:url.href,nextUrl:url,headers:new Headers({origin,'content-type':'application/json'}),json:async()=>body}};
 ctx.params={params:Promise.resolve({id:'a'})};
 ctx.login=()=>{ctx.session=erp?{id:'user',tenantId:'own',role:'STAFF',mustChangePassword:false}:{id:'admin',role:'ADMIN'}};
 ctx.seed=()=>{ctx.record={id:'a',tenantId:'own',clienteId:'c',petId:'pet',servico:'Banho',categoria:'Estéticos',dataHora:new Date('2026-10-21T12:00:00Z'),startsAt:new Date('2026-10-21T12:00:00Z'),updatedAt:new Date('2026-10-20T12:00:00Z'),status:erp?'SCHEDULED':'agendado'}};
 return ctx;
}
test('anonymous users cannot read or modify appointments',async()=>{
 const f=fixture();assert.equal((await f.get(f.req())).status,401);assert.equal((await f.patch(f.req(),f.params)).status,401);assert.equal(f.writes,0);
});
test('restricted roles cannot access operational agenda',async()=>{
 const f=fixture();f.session=erp?{role:'PLATFORM_MANAGER',tenantId:'own',mustChangePassword:false}:{role:'KANBAN'};
 assert.ok([401,403].includes((await f.get(f.req())).status));assert.ok([401,403].includes((await f.patch(f.req({status:erp?'ARRIVED':'confirmado'}),f.params)).status));assert.equal(f.writes,0);
});
test('cross origin mutation is rejected',async()=>{
 const f=fixture();f.login();f.seed();assert.equal((await f.patch(f.req({status:erp?'ARRIVED':'confirmado'},'https://attacker.test'),f.params)).status,403);assert.equal(f.writes,0);
});
test('invalid status does not reach the database writer',async()=>{
 const f=fixture();f.login();f.seed();assert.equal((await f.patch(f.req({status:'INVALID'}),f.params)).status,400);assert.equal(f.writes,0);
});
test('authorized update persists and is returned by subsequent calendar read',async()=>{
 const f=fixture();f.login();f.seed();const status=erp?'ARRIVED':'confirmado';
 const payload=erp?{status,expectedStatus:'SCHEDULED'}:{status,expectedUpdatedAt:f.record.updatedAt.toISOString()};
 assert.equal((await f.patch(f.req(payload),f.params)).status,200);assert.equal(f.writes,1);
 const result=await (await f.get(f.req())).json();assert.equal(result.items[0].status,status);
 if(erp)assert.ok(f.queries.every(q=>q.tenantId==='own'));else assert.equal(f.events,1);
});
test('stale update and competing writes return conflicts',async()=>{
 const f=fixture();f.login();f.seed();const status=erp?'ARRIVED':'confirmado';
 const payload=erp?{status,expectedStatus:'IN_PROGRESS'}:{status,expectedUpdatedAt:'2025-01-01T00:00:00Z'};
 assert.equal((await f.patch(f.req(payload),f.params)).status,409);assert.equal(f.writes,0);
 f.race=true;assert.equal((await f.patch(f.req({status}),f.params)).status,409);assert.equal(f.writes,0);
});
test('tenant isolation or non-admin restriction is enforced',async()=>{
 const f=fixture();f.login();f.seed();
 if(erp){f.record.tenantId='other';assert.equal((await f.patch(f.req({status:'ARRIVED'}),f.params)).status,404);assert.deepEqual((await (await f.get(f.req())).json()).items,[])}
 else{f.session.role='CLIENTE';assert.equal((await f.patch(f.req({status:'confirmado'}),f.params)).status,403)}
 assert.equal(f.writes,0);
});
