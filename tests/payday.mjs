import './runtime.mjs';
import assert from 'node:assert/strict';
const {initial,clean}=await import('../lib/attendance-store.ts');
const {monthEnd}=await import('../lib/workforce.ts');
const {workforceAction}=await import('../lib/workforce-actions.ts');
for(const [month,expected] of [['2026-02','2026-02-28'],['2028-02','2028-02-29'],['2026-04','2026-04-30'],['2026-12','2026-12-31']])assert.equal(monthEnd(month),expected);
const d={...initial(),settings:{payDay:10.04,employerName:'사업주',address:'기존 주소',communityUrl:''}};
assert.equal(clean(d).settings.payDay,'month_end');
assert.equal(clean(d).settings.employerName,'사업주');
for(const payDay of [10.04,31,0,'31',null])await assert.rejects(workforceAction(d,{action:'settings',payDay},'2026-10-27T00:00:00Z'),/말일/);
await workforceAction(d,{action:'settings',payDay:'month_end',employerName:'사업주',address:'기존 주소',lateGraceMinutes:0,communityUrl:''},'2026-10-27T00:00:00Z');
assert.equal(d.settings.payDay,'month_end');assert.equal(d.settings.address,'기존 주소');
console.log('PASS month-end dates, legacy setting display, invalid payday rejection and saved settings.');


