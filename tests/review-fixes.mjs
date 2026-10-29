import {reset,state,database,setNow,env,testSql} from './runtime.mjs';
import assert from 'node:assert/strict';
const store=await import('../lib/attendance-store.ts');
const {shiftSnapshot}=await import('../lib/record-review.ts');
const {monthSummary,localISO,addDays}=await import('../lib/workforce.ts');
const {workforceAction}=await import('../lib/workforce-actions.ts');
const {displayedWork,workforceRequest}=await import('../lib/payroll-display.ts');
const {validateShiftTime}=await import('../lib/shift-time.ts');
const manage=await import('../app/api/manage/route.ts');
setNow('2027-01-02T00:00:00Z');
const employee={id:'e',name:'회귀검증',active:true,hireDate:'2020-01-01',agreedWeeklyHours:30,rates:[{date:'2020-01-01',rate:10000}]};
const base=()=>({...store.initial(),employees:[structuredClone(employee)],patterns:[],scheduleOverrides:[],settings:{},advances:[],contracts:[],sessions:[{token:'review-admin',expires:Date.now()+3600000}]});
const shift=date=>({id:date,employeeId:'e',start:localISO(date,'17:00'),end:localISO(date,'22:00'),breaks:[]});
async function post(body){const r=await manage.POST(new Request('https://test.invalid/api/manage',{method:'POST',headers:{'content-type':'application/json','origin':'https://test.invalid','oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-id':'review','x-admin-token':'review-admin'},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};}

// Read legacy state, publish a 3MB+ UTF-8 document in bounded rows, then restart read.
reset(base());let original=await store.read();const big=structuredClone(original.d);
big.audit=Array.from({length:12},(_,i)=>({at:'2026-10-29',text:String(i)+'한글😀'.repeat(50000)}));
assert(Buffer.byteLength(JSON.stringify(big))>2000000);
await store.save(big,original.rev);
assert.deepEqual((await store.read()).d,big);
const rows=testSql.prepare('SELECT length(CAST(payload AS BLOB)) AS bytes FROM attendance_chunks').all();
assert(rows.length>1);assert(rows.every(r=>r.bytes<2000000));
assert.equal(JSON.parse(testSql.prepare('SELECT payload FROM attendance_store WHERE id=1').get().payload).storageVersion,2);
const beforeStale=database.payload;
await assert.rejects(store.save(original.d,original.rev),/다른 기기/);
assert.equal(database.payload,beforeStale,'a stale writer must not remove current chunks');
const next=await store.read(),db=env.DB;
// Fail an insertion in the middle of the batch: root and all rows must roll back.
env.DB={...db,async batch(statements){
 const index=2;const old=statements[index].execute;
 statements[index].execute=()=>{throw Error('simulated write failure')};
 try{return await db.batch(statements);}finally{statements[index].execute=old;}
}};
await assert.rejects(store.save(big,next.rev),/simulated/);env.DB=db;
assert.equal(database.payload,beforeStale);
console.log('PASS bounded D1 rows, Unicode, legacy migration, stale-writer isolation and atomic rollback');

// An edit must use the version seen by the user, not the revision just read by the API.
let d=base();d.shifts=[shift('2026-09-01')];reset(d);
const seen=shiftSnapshot(d.shifts[0]);const common={action:'shift',id:'2026-09-01',employeeId:'e',start:d.shifts[0].start,breakMinutes:0,reason:'regression'};
assert.equal((await post({...common,end:localISO('2026-09-01','23:00'),expectedSnapshot:seen})).status,200);
assert.equal((await post({...common,end:localISO('2026-09-01','22:00'),expectedSnapshot:seen})).status,400);
assert.equal(state().shifts[0].end,localISO('2026-09-01','23:00'));
assert.equal((await post({...common,end:localISO('2026-09-01','22:00')})).status,400);
console.log('PASS missing/stale manual edit snapshots cannot overwrite newer records');

// September edits invalidate the October weekly allowance and tax review.
d=base();d.employees[0].endDate='2026-10-04';d.patterns=[{employeeId:'e',from:'2026-09-28',to:'2026-10-03',days:[1,2,3,4,5,6],start:'17:00',end:'22:00',breakMinutes:0,mode:'automatic'}];
for(let date='2026-09-28';date<='2026-10-03';date=addDays(date,1))d.shifts.push(shift(date));
d.adjustments['e_2026-10']={reviewed:true,taxConfirmed:true,incomeTax:6300};reset(d);
assert.equal(monthSummary(d,d.employees[0],'2026-10').weekly,60000);
const moving=state().shifts[0];const change={action:'shift',id:moving.id,employeeId:'e',start:localISO('2026-09-27','17:00'),end:localISO('2026-09-27','22:00'),expectedSnapshot:shiftSnapshot(moving),breakMinutes:0,reason:'date correction'};
assert.equal((await post(change)).status,200);
assert.equal(state().adjustments['e_2026-10'].reviewed,false);assert.equal(state().adjustments['e_2026-10'].taxConfirmed,false);
assert.equal((await post({action:'schedule',employeeId:'e',date:'2026-09-28',start:'17:00',end:'22:00',breakMinutes:0,attendance:'absent',reason:'absence'})).status,200);
assert.equal((await post({action:'close',month:'2026-10'})).status,400);
reset({...d,closed:{'2026-10':{rows:[]}}});const beforeClosed=database.payload;
assert.equal((await post(change)).status,400);assert.equal(database.payload,beforeClosed);
console.log('PASS dependent month re-review and closed-weekly-allowance protection');

// All scheduling paths require an explicit overnight choice and long-shift consent.
const schedule={action:'schedule',employeeId:'e',date:'2026-09-01',start:'16:00',end:'15:00',breakMinutes:30,reason:'review'};
await assert.rejects(workforceAction(base(),schedule,'2026-10-01T00:00:00Z'),/출퇴근/);
await assert.rejects(workforceAction(base(),{...schedule,nextDay:true},'2026-10-01T00:00:00Z'),/12시간/);
d=base();await workforceAction(d,{...schedule,nextDay:true,longShiftConfirmed:true},'2026-10-01T00:00:00Z');
assert.equal((Date.parse(d.scheduleOverrides[0].end)-Date.parse(d.scheduleOverrides[0].start))/60000-30,1350);
const pattern={...schedule,action:'pattern',from:'2026-09-01',to:'2026-09-30',days:[1]};
await assert.rejects(workforceAction(base(),pattern,'2026-10-01T00:00:00Z'),/출퇴근/);
await assert.rejects(workforceAction(base(),{...schedule,action:'scheduleCopy',sourceDate:'2026-08-31',dates:['2026-09-01']},'2026-10-01T00:00:00Z'),/출퇴근/);
assert.throws(()=>validateShiftTime(localISO('2026-09-01','17:00'),localISO('2026-09-02','17:00'),0,true),/24시간/);
assert.throws(()=>validateShiftTime(localISO('2026-09-01','17:00'),localISO('2026-09-01','22:00'),300),/휴게/);
console.log('PASS explicit overnight, long-shift consent, copy/pattern validation and manual time bounds');

for(const status of ['결근','무급휴가','휴무'])assert.equal(displayedWork({status,hours:0,plannedHours:5}).hours,0);
assert.deepEqual(displayedWork({status:'근무 완료',worked:true,hours:0,plannedHours:5}),{hours:0,actual:true});
assert.equal(displayedWork({status:'유급휴가',hours:0,plannedHours:5}).hours,5);
d=base();d.employees[0].agreedWeeklyHours=0;d.shifts=[shift('2026-09-01')];
let summary=monthSummary(d,d.employees[0],'2026-09');assert.equal(summary.gross,50000);assert.equal(summary.forecastGross,50000);
assert.equal(monthSummary(base(),employee,'2026-09').forecastGross,0,'no weekly benefit forecast without any schedule');
assert.equal(workforceRequest({type:'advance',month:'2026-11',amount:10000},'2026-10').month,'2026-11');
console.log('PASS unpaid calendar amounts, actual zero hours, actual-only forecast and selected advance month');
