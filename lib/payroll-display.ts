// Actual zero-hour records and resolved unpaid days must never fall back to plans.
export function displayedWork(r:any){
 if(!r)return {hours:0,actual:false};
 if(['결근','무급휴가','휴무'].includes(r.status))return {hours:0,actual:false};
 const actual=Number(r.hours||0);
 const complete=r.worked===true||(r.records||[]).some((s:any)=>s.end);
 if(complete||actual>0)return {hours:actual,actual:true};
 return {hours:Number(r.plannedHours||0),actual:false};
}
export function workforceRequest(form:any,month:string){
 return {...form,action:form.type,month:form.type==='advance'?form.month:month};
}
