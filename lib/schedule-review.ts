// Shared eligibility and snapshots keep calendar actions consistent with server checks.
export function canConfirmSchedule(row:any){return !!row?.plan&&row.plan.attendance==='work'&&row.elapsed&&!row.confirmed&&(row.provisional||!row.records.length)&&!row.records.some((s:any)=>!s.end&&s.breaks.some((b:any)=>!b.end));}
export function canCheckInSchedule(row:any,now:string){return !!row?.plan&&row.plan.attendance==='work'&&now>=row.plan.start&&now<row.plan.end&&!row.records.length;}
export function scheduleSnapshot(row:any){return JSON.stringify({employeeId:row.employeeId,date:row.date,start:row.plan?.start,end:row.plan?.end,breakMinutes:row.plan?.breakMinutes,attendance:row.plan?.attendance,records:row.records.map((s:any)=>({id:s.id,start:s.start,end:s.end,breaks:s.breaks}))});}
