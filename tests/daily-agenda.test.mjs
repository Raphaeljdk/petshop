import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarRange,calendarPage,appointmentTransitions,loadCalendarPages} from '../src/lib/daily-agenda.ts';
test('validates range without losing offset or month boundary',()=>{
 const range=calendarRange('2026-10-01T00:00:00-03:00','2026-10-31T23:59:59-03:00');
 assert.equal(range.gte.toISOString(),'2026-10-01T03:00:00.000Z');
 assert.equal(range.lte.toISOString(),'2026-11-01T02:59:59.000Z');
 for(const [start,end] of [[null,null],['invalid','invalid'],['2026-10-02','2026-10-01'],['2026-01-01','2026-12-01']]) assert.throws(()=>calendarRange(start,end));
});
test('rejects invalid pagination instead of skipping appointments',()=>{
 assert.equal(calendarPage(null),1);assert.equal(calendarPage('3'),3);
 for(const page of ['-1','0','1.2','NaN','10001']) assert.throws(()=>calendarPage(page));
});
test('status transitions preserve the established workflow',()=>{
 assert.deepEqual(appointmentTransitions.SCHEDULED,['ARRIVED','CANCELLED']);
 assert.deepEqual(appointmentTransitions.ARRIVED,['IN_PROGRESS','CANCELLED']);
 assert.deepEqual(appointmentTransitions.IN_PROGRESS,['COMPLETED','CANCELLED']);
 assert.deepEqual(appointmentTransitions.COMPLETED,[]);assert.deepEqual(appointmentTransitions.CANCELLED,[]);
});
test('loads all pages including more than 500 real records',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url,options});
  const page=new URL(url,'https://test.local').searchParams.get('pagina');
  return Response.json({items:page==='1'?Array.from({length:500},(_,id)=>({id})): [{id:500}],truncado:page==='1'});
 });
 const signal=new AbortController().signal;
 const items=await loadCalendarPages('/api/appointments?inicio=2026-10-01&fim=2026-11-01',signal);
 assert.equal(items.length,501);assert.equal(calls.length,2);assert.equal(calls[1].options.signal,signal);
 assert.equal(calls[0].options.cache,'no-store');
});
test('failure on later page rejects partial data',async t=>{
 let n=0;t.mock.method(globalThis,'fetch',async()=>++n===1?Response.json({items:[{id:1}],truncado:true}):Response.json({error:'Sem permissão'},{status:403}));
 await assert.rejects(loadCalendarPages('/api/appointments?inicio=a',new AbortController().signal),/Sem permissão/);
});
test('aborted navigation cannot publish a partial calendar',async t=>{
 const controller=new AbortController();controller.abort();
 t.mock.method(globalThis,'fetch',async(_url,{signal})=>{signal.throwIfAborted()});
 await assert.rejects(loadCalendarPages('/api/appointments?inicio=a',controller.signal),{name:'AbortError'});
});
test('invalid or empty continuation fails without infinite loop',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({items:[],truncado:true}));
 await assert.rejects(loadCalendarPages('/api/appointments?inicio=a',new AbortController().signal),/mudou/);
});
