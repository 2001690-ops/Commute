import './runtime.mjs';
import {performance} from 'node:perf_hooks';
const {calculate}=await import('../lib/payroll.ts');
const {localISO,addDays}=await import('../lib/workforce.ts');
const d={employees:[],shifts:[],patterns:[],scheduleOverrides:[],adjustments:{},closed:{},settings:{},advances:[]};
for(let i=0;i<12;i++){const e={id:'e'+i,name:'검증'+i,hireDate:'2025-01-01',agreedWeeklyHours:30,rates:[{date:'2025-01-01',rate:12500}]};d.employees.push(e);d.patterns.push({employeeId:e.id,from:'2025-08-01',to:'2026-10-31',days:[1,2,3,4,5,6],start:'17:00',end:'22:30',breakMinutes:30,mode:'automatic'});for(let date='2025-08-01';date<='2026-10-31';date=addDays(date,1)){if(new Date(date+'T00:00Z').getUTCDay()===0)continue;d.shifts.push({id:e.id+date,employeeId:e.id,start:localISO(date,'17:00'),end:localISO(date,'22:30'),breaks:[{start:localISO(date,'19:00'),end:localISO(date,'19:30')}]});}}
const start=performance.now();const rows=calculate(d,'2026-10');console.log(JSON.stringify({employees:12,shifts:d.shifts.length,month:'2026-10',milliseconds:Math.round(performance.now()-start),rows:rows.length}));
