import {monthSummary,calculationContext} from './workforce';
export {day,minutes} from './time';
export function calculate(data:any,month:string){const now=new Date().toISOString(),context=calculationContext(data,now);return data.employees.map((e:any)=>{const r=monthSummary(data,e,month,now,context);const {rows,...result}=r;return result;});}
