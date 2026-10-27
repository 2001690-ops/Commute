import {dailyRecords,rateAt} from './workforce';
import {day,minutes} from './time';
export function reportingRows(d:any,month:string){return dailyRecords(d,month).filter(r=>r.confirmed&&r.hours>0&&d.employees.find((e:any)=>e.id===r.employeeId)?.reportType==='daily').map(r=>{const e=d.employees.find((e:any)=>e.id===r.employeeId);return {employeeId:e.id,name:e.name,date:r.date,actualHours:Number(r.hours.toFixed(4)),referenceHours:e.reportReferenceHours||null,baseWage:Math.round(r.records.filter((s:any)=>s.end).reduce((a:number,s:any)=>a+minutes(s)/60*rateAt(e,day(s.start)),0))};});}
